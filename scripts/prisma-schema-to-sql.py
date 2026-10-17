#!/usr/bin/env python3
"""Generates prisma/migrations/0001_init/migration.sql from prisma/schema.prisma.
Dev convenience for environments where Prisma's schema engine cannot be downloaded.
On a normal machine you can instead run `npx prisma migrate dev` and discard this."""
import re, sys
src = open("prisma/schema.prisma").read()
enums = dict(re.findall(r"enum (\w+) \{([^}]*)\}", src))
models = re.findall(r"model (\w+) \{([^}]*)\}", src)
TYPES = {"String": "TEXT", "Int": "INTEGER", "Boolean": "BOOLEAN", "DateTime": "TIMESTAMP(3)", "Json": "JSONB"}
out = ["-- Generated from prisma/schema.prisma by scripts/prisma-schema-to-sql.py\n"]
for name, body in enums.items():
    vals = ", ".join(f"'{v}'" for v in body.split())
    out.append(f'CREATE TYPE "{name}" AS ENUM ({vals});\n')
fks, idx = [], []
for mname, body in models:
    cols, pk = [], None
    for line in body.strip().splitlines():
        line = line.strip()
        if not line or line.startswith("//"): continue
        if line.startswith("@@unique"):
            f = re.search(r"\[(.*?)\]", line).group(1).replace(" ", "").split(",")
            idx.append(f'CREATE UNIQUE INDEX "{mname}_{"_".join(f)}_key" ON "{mname}"({", ".join(chr(34)+x+chr(34) for x in f)});')
            continue
        if line.startswith("@@index"):
            f = re.search(r"\[(.*?)\]", line).group(1).replace(" ", "").split(",")
            idx.append(f'CREATE INDEX "{mname}_{"_".join(f)}_idx" ON "{mname}"({", ".join(chr(34)+x+chr(34) for x in f)});')
            continue
        m = re.match(r"(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)", line)
        fname, ftype, isarr, opt, attrs = m.groups()
        if "@relation" in attrs:
            r = re.search(r"fields: \[(\w+)\], references: \[(\w+)\](?:, onDelete: (\w+))?", attrs)
            od = {"Cascade": "CASCADE", None: "RESTRICT"}[r.group(3)]
            fks.append(f'ALTER TABLE "{mname}" ADD CONSTRAINT "{mname}_{r.group(1)}_fkey" FOREIGN KEY ("{r.group(1)}") REFERENCES "{ftype}"("{r.group(2)}") ON DELETE {od} ON UPDATE CASCADE;')
            continue
        if ftype not in TYPES and ftype not in enums: continue  # back-relation list
        sqltype = TYPES.get(ftype) or f'"{ftype}"'
        col = f'"{fname}" {sqltype}'
        if not opt: col += " NOT NULL"
        d = re.search(r"@default\((.*?)\)(?:\s|$)", attrs)
        if d:
            v = d.group(1)
            if v == "now()": col += " DEFAULT CURRENT_TIMESTAMP"
            elif v in ("true", "false"): col += f" DEFAULT {v}"
            elif v == "cuid()": pass
            elif v.isdigit(): col += f" DEFAULT {v}"
            elif v.startswith('"'): col += f" DEFAULT '{v.strip(chr(34))}'"
            else: col += f" DEFAULT '{v}'"
        if "@id" in attrs: pk = fname
        if "@unique" in attrs:
            idx.append(f'CREATE UNIQUE INDEX "{mname}_{fname}_key" ON "{mname}"("{fname}");')
        cols.append(col)
    cols.append(f'CONSTRAINT "{mname}_pkey" PRIMARY KEY ("{pk}")')
    out.append(f'CREATE TABLE "{mname}" (\n  ' + ",\n  ".join(cols) + "\n);\n")
out += [s + "\n" for s in idx] + [s + "\n" for s in fks]
open("prisma/migrations/0001_init/migration.sql", "w").write("\n".join(out))
print("wrote migration.sql", len(out), "statements")
