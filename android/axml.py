"""Gera um AndroidManifest.xml binário (AXML) para um APK sem resources.arsc.

Uso:
  python3 axml.py saida.xml --pacote com.exemplo.app --nome "Meu App" \
      --versao-numero 1 --versao-nome 1.0 [--min-sdk 24] [--target-sdk 34] [--internet]
"""
import argparse, struct

NS = "http://schemas.android.com/apk/res/android"
ATTR_IDS = {
    "label": 0x01010001, "name": 0x01010003, "exported": 0x01010010,
    "configChanges": 0x0101001F, "minSdkVersion": 0x0101020C, "versionCode": 0x0101021B,
    "versionName": 0x0101021C, "windowSoftInputMode": 0x0101022B, "targetSdkVersion": 0x01010270,
    "allowBackup": 0x01010280, "required": 0x0101028E, "usesCleartextTraffic": 0x010104EC,
}
T_STRING, T_INT_DEC, T_INT_HEX, T_BOOL = 0x03, 0x10, 0x11, 0x12


def tree(a):
    perms = [("uses-permission", [(True, "name", "s", "android.permission.INTERNET")], [])] if a.internet else []
    return ("manifest", [(False, "package", "s", a.pacote),
                         (True, "versionCode", "i", a.versao_numero), (True, "versionName", "s", a.versao_nome)], [
        ("uses-sdk", [(True, "minSdkVersion", "i", a.min_sdk), (True, "targetSdkVersion", "i", a.target_sdk)], []),
        *perms,
        # Telão: roda em TV Box (sem tela de toque) e aceita canais http:// quando tem internet.
        ("uses-feature", [(True, "name", "s", "android.hardware.touchscreen"), (True, "required", "b", False)], []),
        ("uses-feature", [(True, "name", "s", "android.software.leanback"), (True, "required", "b", False)], []),
        ("application", [(True, "label", "s", a.nome), (True, "allowBackup", "b", False)]
            + ([(True, "usesCleartextTraffic", "b", True)] if a.internet else []), [
            ("activity", [(True, "name", "s", a.pacote + ".MainActivity"), (True, "label", "s", a.nome),
                          (True, "exported", "b", True), (True, "configChanges", "x", 0x4A0),
                          (True, "windowSoftInputMode", "x", 0x10)], [
                ("intent-filter", [], [
                    ("action", [(True, "name", "s", "android.intent.action.MAIN")], []),
                    ("category", [(True, "name", "s", "android.intent.category.LAUNCHER")], []),
                    ("category", [(True, "name", "s", "android.intent.category.LEANBACK_LAUNCHER")], []),
                ]),
            ]),
        ]),
    ])


def build(root):
    # Nomes de atributos android: vêm primeiro no pool, alinhados com o mapa de recursos.
    attr_names, others = [], []

    def walk(n):
        tag, attrs, kids = n
        for ns, name, kind, val in attrs:
            lst = attr_names if ns else others
            if name not in lst: lst.append(name)
            if kind == "s" and val not in others: others.append(val)
        if tag not in others: others.append(tag)
        for k in kids: walk(k)
    walk(root)
    for s in ("android", NS):
        if s not in others: others.append(s)
    strings = attr_names + [s for s in others if s not in attr_names]
    idx = {s: i for i, s in enumerate(strings)}

    data, offsets = b"", []
    for s in strings:
        offsets.append(len(data))
        u = s.encode("utf-16-le")
        data += struct.pack("<H", len(u) // 2) + u + b"\x00\x00"
    while len(data) % 4: data += b"\x00"
    start = 28 + 4 * len(strings)
    sp = struct.pack("<HHIIIIII", 0x0001, 28, start + len(data), len(strings), 0, 0, start, 0)
    sp += b"".join(struct.pack("<I", o) for o in offsets) + data

    rm_body = b"".join(struct.pack("<I", ATTR_IDS[n]) for n in attr_names)
    rm = struct.pack("<HHI", 0x0180, 8, 8 + len(rm_body)) + rm_body

    out = []
    line = [1]

    def node(typ, ext):
        out.append(struct.pack("<HHIII", typ, 16, 16 + len(ext), line[0], 0xFFFFFFFF) + ext)
        line[0] += 1

    node(0x0100, struct.pack("<II", idx["android"], idx[NS]))

    def emit(n):
        tag, attrs, kids = n
        enc = []
        for ns, name, kind, val in attrs:
            if kind == "s": raw, typ, d = idx[val], T_STRING, idx[val]
            elif kind == "i": raw, typ, d = 0xFFFFFFFF, T_INT_DEC, val
            elif kind == "x": raw, typ, d = 0xFFFFFFFF, T_INT_HEX, val
            else: raw, typ, d = 0xFFFFFFFF, T_BOOL, (0xFFFFFFFF if val else 0)
            rid = ATTR_IDS[name] if ns else 0
            enc.append((rid, struct.pack("<IIIHBBI", idx[NS] if ns else 0xFFFFFFFF, idx[name], raw, 8, 0, typ, d)))
        enc.sort(key=lambda x: x[0])  # ordenado pelo id do recurso, como o aapt faz
        node(0x0102, struct.pack("<IIHHHHHH", 0xFFFFFFFF, idx[tag], 20, 20, len(enc), 0, 0, 0) + b"".join(e[1] for e in enc))
        for k in kids: emit(k)
        node(0x0103, struct.pack("<II", 0xFFFFFFFF, idx[tag]))
    emit(root)
    node(0x0101, struct.pack("<II", idx["android"], idx[NS]))

    content = sp + rm + b"".join(out)
    return struct.pack("<HHI", 0x0003, 8, 8 + len(content)) + content


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("saida")
    p.add_argument("--pacote", required=True)
    p.add_argument("--nome", required=True)
    p.add_argument("--versao-numero", type=int, required=True)
    p.add_argument("--versao-nome", required=True)
    p.add_argument("--min-sdk", type=int, default=24)
    p.add_argument("--target-sdk", type=int, default=34)
    p.add_argument("--internet", action="store_true")
    a = p.parse_args()
    open(a.saida, "wb").write(build(tree(a)))
