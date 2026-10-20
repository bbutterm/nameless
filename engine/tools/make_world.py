"""Build engine/data/world.js — a light world map for history/geography videos.
Source: Natural Earth 1:50m (public domain, naturalearthdata.com): land, major lakes, major rivers.
usage: python3 engine/tools/make_world.py [--tol 0.06]
Output: window.WORLD = {land: [ring...], lakes: [{name, rings}], rivers: [{name, lines}]}, points as [lon, lat] (0.01°).
The modern Aral Sea is replaced by its historic shoreline (it was full until the 1960s)."""
import json, sys, argparse, urllib.request, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[2]
CACHE = ROOT / 'out' / 'ne'
BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/'
RIVERS = {'Volga', 'Danube', 'Huang', 'Yangtze', 'Amur', 'Ob', 'Irtysh', 'Syr Darya', 'Amu  Darya', 'Tigris', 'Euphrates', 'Indus',
          'Ganges', 'Dnieper', 'Don', 'Ural', 'Selenge (Selenga)', 'Lena', 'Yenisey', 'Nile', 'Rhine', 'Vistula', 'Kama', 'Tarim', 'Mississippi', 'Amazon', 'Mekong'}
LAKES = {'Caspian Sea', 'Lake Baikal', 'Lake Balkhash', 'Lake Ladoga', 'Lake Onega', 'Issyk-Kul', 'Lake Victoria', 'Lake Superior',
         'Lake Michigan', 'Lake Huron', 'Lake Erie', 'Lake Tanganyika', 'Lake Malawi', 'Lake Khanka', 'Qinghai Hu', 'Dongting Hu', 'Poyang Hu', 'Lake Van', 'Lake Urmia'}
ARAL_HISTORIC = [[58.3, 45.6], [58.6, 46.6], [59.9, 46.9], [61.2, 46.6], [61.9, 45.6], [61.4, 44.3], [60.2, 43.5], [59.0, 43.6], [58.3, 44.6]]

def get(name):
    CACHE.mkdir(parents=True, exist_ok=True); p = CACHE / f'{name}.geojson'
    if not p.exists(): urllib.request.urlretrieve(BASE + name + '.geojson', p)
    return json.load(open(p, encoding='utf-8'))

def dp(pts, tol):
    """Douglas–Peucker simplification."""
    if len(pts) < 3: return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True; stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop(); (x1, y1), (x2, y2) = pts[a], pts[b]; dx, dy = x2 - x1, y2 - y1; L = (dx * dx + dy * dy) ** 0.5 or 1e-12
        best, bi = 0, -1
        for i in range(a + 1, b):
            d = abs(dy * (pts[i][0] - x1) - dx * (pts[i][1] - y1)) / L
            if d > best: best, bi = d, i
        if best > tol: keep[bi] = True; stack += [(a, bi), (bi, b)]
    return [p for p, k in zip(pts, keep) if k]

def dp_ring(r, tol):
    """Closed ring: split at the point farthest from the start, simplify both halves."""
    far = max(range(len(r)), key=lambda i: (r[i][0] - r[0][0]) ** 2 + (r[i][1] - r[0][1]) ** 2)
    return dp(r[:far + 1], tol)[:-1] + dp(r[far:], tol)

def area(r): return abs(sum(r[i][0] * r[i - 1][1] - r[i - 1][0] * r[i][1] for i in range(len(r)))) / 2
def rnd(r): return [[round(x, 2), round(y, 2)] for x, y in r]
def rings(geom):
    if geom['type'] == 'Polygon': return [geom['coordinates'][0]]
    if geom['type'] == 'MultiPolygon': return [p[0] for p in geom['coordinates']]
    return []
def lines(geom):
    if geom['type'] == 'LineString': return [geom['coordinates']]
    if geom['type'] == 'MultiLineString': return geom['coordinates']
    return []

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--tol', type=float, default=0.06); a = ap.parse_args()
    land = []
    for f in get('ne_50m_land')['features']:
        for r in rings(f['geometry']):
            if area(r) < 0.15: continue  # drop tiny islands
            s = dp_ring(r, a.tol)
            if len(s) >= 4: land.append(rnd(s))
    lakes = [{'name': 'Aral Sea', 'rings': [ARAL_HISTORIC]}]
    for f in get('ne_50m_lakes')['features']:
        n = f['properties'].get('name')
        if n in LAKES: lakes.append({'name': n, 'rings': [rnd(dp_ring(r, a.tol)) for r in rings(f['geometry'])]})
    rivers = {}
    for f in get('ne_50m_rivers_lake_centerlines')['features']:
        n = f['properties'].get('name')
        if n in RIVERS: rivers.setdefault(n.replace('  ', ' ').replace(' (Selenga)', ''), []).extend(rnd(dp(l, a.tol)) for l in lines(f['geometry']))
    out = {'source': 'Natural Earth 1:50m (public domain)', 'land': land, 'lakes': lakes, 'rivers': [{'name': k, 'lines': v} for k, v in rivers.items()]}
    p = ROOT / 'engine' / 'data' / 'world.js'
    p.write_text('window.WORLD = ' + json.dumps(out, separators=(',', ':')) + ';\n', encoding='utf-8')
    print(p, f'{p.stat().st_size / 1e3:.0f} kB', len(land), 'land rings,', len(lakes), 'lakes,', len(rivers), 'rivers')

if __name__ == '__main__': main()
