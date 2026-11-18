import 'server-only';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { x } from 'tar';
import ts from 'typescript';
import { featuredResonators } from '../resonators';
import { weaponCatalog } from '../weapons/catalog';
import fingerprints from '../game-data/fingerprints.json';

export type CatalogItem = { kind: 'resonator' | 'weapon' | 'echo' | 'sonata'; key: string; name: string; image: string; details: Record<string, unknown> };

function property(object: ts.ObjectLiteralExpression, key: string): ts.Expression | undefined {
  const item = object.properties.find(node => ts.isPropertyAssignment(node) && (node.name.getText().replace(/^['"]|['"]$/g, '') === key));
  return item && ts.isPropertyAssignment(item) ? item.initializer : undefined;
}
function literal(node: ts.Node | undefined): unknown {
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal).filter(value => value !== undefined);
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.flatMap(item => ts.isPropertyAssignment(item) ? [[item.name.getText().replace(/^['"]|['"]$/g, ''), literal(item.initializer)]] : []).filter(([, value]) => value !== undefined));
  return undefined;
}
function initializer(text: string, name: string): ts.ObjectLiteralExpression | undefined {
  const source = ts.createSourceFile(name + '.ts', text, ts.ScriptTarget.Latest, true);
  for (const statement of source.statements) if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
    if (declaration.name.getText(source) === name && declaration.initializer && ts.isObjectLiteralExpression(declaration.initializer)) return declaration.initializer;
  }
  return undefined;
}
function basicInfo(text: string): Record<string, unknown> | undefined {
  const source = ts.createSourceFile('basic.ts', text, ts.ScriptTarget.Latest, true);
  for (const statement of source.statements) if (ts.isFunctionDeclaration(statement) && statement.name?.text === 'getCharacterBasicInfo') {
    for (const node of statement.body?.statements || []) if (ts.isReturnStatement(node) && node.expression && ts.isObjectLiteralExpression(node.expression)) return literal(node.expression) as Record<string, unknown>;
  }
  return undefined;
}
function safeImage(value: unknown, assetSha: string): string {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value), prefix = '/wuthering-waves-assets/images/';
    if (url.protocol !== 'https:' || url.pathname.includes('..') || url.search || url.hash) return '';
    if (url.hostname === 'ryanbenson.github.io' && url.pathname.startsWith(prefix)) return `https://raw.githubusercontent.com/ryanbenson/wuthering-waves-assets/${assetSha}/images/${url.pathname.slice(prefix.length)}`;
    if (url.hostname === 'static.nanoka.cc' && url.pathname.startsWith('/assets/ww/')) return url.href;
    if (url.hostname === 'api.encore.moe' && url.pathname.startsWith('/resource/Data/Game/Aki/')) return url.href;
    return '';
  }
  catch { return ''; }
}
function entries(object: ts.ObjectLiteralExpression | undefined): [string, Record<string, unknown>][] {
  if (!object) return [];
  return object.properties.flatMap(node => ts.isPropertyAssignment(node) && ts.isObjectLiteralExpression(node.initializer) ? [[node.name.getText().replace(/^['"]|['"]$/g, ''), literal(node.initializer) as Record<string, unknown>]] : []);
}
export async function collectCatalog(optimizerSha: string, assetSha: string): Promise<CatalogItem[]> {
  if (!/^[a-f0-9]{40}$/.test(optimizerSha) || !/^[a-f0-9]{40}$/.test(assetSha)) throw Error('Invalid source revisions.');
  const response = await fetch(`https://api.github.com/repos/ryanbenson/wuthering-waves-optimizer/tarball/${optimizerSha}`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Tacet-Discords-catalog-import' }, cache: 'no-store', signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw Error('Could not download the pinned upstream catalog.');
  const archive = Buffer.from(await response.arrayBuffer());
  if (archive.length > 25_000_000) throw Error('The upstream archive exceeds the import limit.');
  const temporary = await mkdtemp(join(tmpdir(), 'tacet-catalog-'));
  try {
    const file = join(temporary, 'source.tar.gz');
    await writeFile(file, archive);
    await x({ file, cwd: temporary, strip: 1, strict: true });
    const read = (path: string) => readFile(join(temporary, 'src', path), 'utf8');
    const roster = initializer(await read('characters/characters.ts'), 'characterPickerRoster');
    const keys = new Set<string>();
    if (roster) for (const group of roster.properties) if (ts.isPropertyAssignment(group) && ts.isArrayLiteralExpression(group.initializer)) for (const entry of group.initializer.elements) if (ts.isObjectLiteralExpression(entry)) {
      const key = literal(property(entry, 'key'));
      if (typeof key === 'string' && /^[A-Za-z0-9]{2,64}$/.test(key)) keys.add(key);
    }
    const currentCharacters = new Set(featuredResonators.map(item => item.name));
    const currentWeapons = new Set(weaponCatalog.map(item => item.key));
    const currentEchoes = new Set(fingerprints.echoes.map(item => item.key));
    const currentSets = new Set(fingerprints.sets.map(item => item.key));
    const result: CatalogItem[] = [];
    for (const key of keys) {
      if (currentCharacters.has(key)) continue;
      const info = basicInfo(await read(`characters/${key}/basic.ts`));
      if (!info || typeof info.name !== 'string' || info.name.length > 80 || !['Sword', 'Broadblade', 'Pistols', 'Rectifier', 'Gauntlets'].includes(String(info.weapon)) || !['Aero', 'Glacio', 'Fusion', 'Havoc', 'Spectro', 'Electro'].includes(String(info.element))) continue;
      result.push({ kind: 'resonator', key, name: String(info.name), image: `https://raw.githubusercontent.com/ryanbenson/wuthering-waves-assets/${assetSha}/images/${key}.png`, details: { element: info.element, weapon: info.weapon, rarity: info.rarity, signatureWeapon: info.signatureWeapon } });
    }
    const weaponTypes = [['Swords', 'Sword'], ['Broadblades', 'Broadblade'], ['Pistols', 'Pistols'], ['Rectifiers', 'Rectifier'], ['Gauntlets', 'Gauntlets']] as const;
    for (const [folder, type] of weaponTypes) {
      const { readdir } = await import('node:fs/promises');
      for (const filename of await readdir(join(temporary, 'src', 'weapons', folder))) {
        if (!/^[A-Za-z0-9]+\.ts$/.test(filename)) continue;
        const key = filename.slice(0, -3);
        if (currentWeapons.has(key)) continue;
        const info = initializer(await read(`weapons/${folder}/${filename}`), 'weaponInfo');
        if (!info) continue;
        const name = literal(property(info, 'name')), rarity = literal(property(info, 'rarity'));
        if (typeof name !== 'string' || ![1, 2, 3, 4, 5].includes(Number(rarity))) continue;
        result.push({ kind: 'weapon', key, name, image: `https://raw.githubusercontent.com/ryanbenson/wuthering-waves-assets/${assetSha}/images/weapons/${key}.png`, details: { type, rarity, passiveName: literal(property(info, 'passiveName')), passiveValue: literal(property(info, 'passiveValue')), passives: literal(property(info, 'passiveData')) } });
      }
    }
    const echoSource = await read('echoes/index.ts');
    for (const [key, info] of entries(initializer(echoSource, 'mainEchoesData'))) if (!currentEchoes.has(key) && typeof info.name === 'string') result.push({ kind: 'echo', key, name: info.name, image: safeImage(info.image, assetSha), details: { class: info.class, description: info.details, sets: info.sets, modifiers: info.modifiers, actions: info.actions } });
    const setSource = await read('echoes/stats.ts');
    const labels = initializer(setSource, 'echoSetLabelMap'), images = initializer(setSource, 'echoSetImageMap');
    const bonusSource = await read('echoes/sets.ts');
    const bonuses = ['setBonusEffectsOnePiece', 'setBonusEffectsOne', 'setBonusEffectsTwo'].flatMap(name => entries(initializer(bonusSource, name)));
    if (labels) for (const node of labels.properties) if (ts.isPropertyAssignment(node)) {
      const key = node.name.getText().replace(/^['"]|['"]$/g, ''), name = literal(node.initializer);
      if (!currentSets.has(key) && typeof name === 'string') result.push({ kind: 'sonata', key, name, image: safeImage(images && literal(property(images, key)), assetSha), details: { bonuses: bonuses.filter(([label]) => label.startsWith(`${name} `)).map(([label, value]) => ({ label, ...value })) } });
    }
    if (result.length > 250) throw Error('Unexpectedly large catalog change; review the source manually.');
    return result;
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
