# Reads a packed GLB's own JSON: names, triangles, attribute types, node transforms. Proof of what the page will get.
import json, struct, sys
for path in sys.argv[1:]:
    b = open(path, 'rb').read()
    n = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + n])
    ac = j['accessors']
    print(path, len(b), 'bytes; extensions', j.get('extensionsUsed'), 'materials', [m.get('name') for m in j.get('materials', [])])
    bad, tot = [], 0
    for nd in j['nodes']:
        if 'mesh' not in nd:
            continue
        m = j['meshes'][nd['mesh']]
        p = m['primitives'][0]
        t = sum(ac[q['indices']]['count'] // 3 for q in m['primitives'])
        tot += t
        a = p['attributes']
        info = {k: (ac[v]['componentType'], ac[v]['type'], ac[v].get('normalized', False)) for k, v in a.items()}
        tr = {k: nd[k] for k in ('translation', 'scale', 'rotation', 'matrix') if k in nd}
        if tr:
            bad.append(nd.get('name'))
        print('  %-16s %6d tris %d prims %s %s' % (nd.get('name'), t, len(m['primitives']), tr if len(sys.argv) > 2 and tr else '', info if nd is j['nodes'][0] else ''))
    print('  nodes with a transform:', len(bad), 'total tris', tot)
