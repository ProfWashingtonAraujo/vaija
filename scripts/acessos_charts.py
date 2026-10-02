"""Gráficos de acessos do Vaija: usuários por cliente/papel e sessões ativas por usuário.

Lê direto do Postgres do docker compose (container vaija-postgres) e salva PNG em reports/.
Uso:  .venv/Scripts/python scripts/acessos_charts.py
"""
import csv
import io
import subprocess
from collections import OrderedDict
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "reports" / "acessos.png"

# Paleta categórica validada (slots 1-3), fixa por papel — a cor segue a entidade.
SURFACE, INK, INK_2, GRID = "#fcfcfb", "#0b0b0b", "#52514e", "#e6e5e1"
ROLES = OrderedDict([("admin", ("Administrador", "#2a78d6")),
                     ("manager", ("Gerente", "#eb6834")),
                     ("operator", ("Operador", "#1baf7a"))])
TENANT_NAMES = {"default": "Taperas Pizzaria", "admin": "Plataforma Vaija"}

SQL = """select u.tenant_id, u.role_key, u.email,
         (select count(*) from auth_sessions s where s.user_id = u.id and s.expires_at > now())
         from users u order by 1, 2, 3"""


def fetch_rows() -> list[dict]:
    out = subprocess.run(
        ["docker", "exec", "vaija-postgres", "psql", "-U", "postgres", "-d", "vaija",
         "--csv", "-t", "-c", SQL],
        check=True, capture_output=True, text=True, encoding="utf-8",
    ).stdout
    return [dict(zip(("tenant", "role", "email", "sessions"), r)) for r in csv.reader(io.StringIO(out))]


def tenant_label(tenant: str) -> str:
    return TENANT_NAMES.get(tenant, tenant.replace("-", " ").title())


def style(ax):
    ax.set_facecolor(SURFACE)
    for side in ("top", "right", "left"):
        ax.spines[side].set_visible(False)
    ax.spines["bottom"].set_color(GRID)
    ax.tick_params(colors=INK_2, length=0, labelsize=10)
    ax.xaxis.grid(True, color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)


def main():
    rows = fetch_rows()
    tenants = list(OrderedDict.fromkeys(r["tenant"] for r in rows))

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5.2), facecolor=SURFACE,
                                   gridspec_kw={"width_ratios": [1, 1.25], "wspace": 0.55})

    # 1) Usuários por cliente, empilhados por papel (gap de 2px de superfície entre segmentos)
    style(ax1)
    ys = range(len(tenants))
    left = [0] * len(tenants)
    for key, (label, color) in ROLES.items():
        vals = [sum(1 for r in rows if r["tenant"] == t and r["role"] == key) for t in tenants]
        ax1.barh(ys, vals, left=left, height=0.5, color=color, edgecolor=SURFACE, linewidth=2, label=label)
        for y, v, l in zip(ys, vals, left):
            if v:
                ax1.text(l + v / 2, y, str(v), ha="center", va="center", color="white", fontweight="bold", fontsize=11)
        left = [l + v for l, v in zip(left, vals)]
    for y, total in zip(ys, left):
        ax1.text(total + 0.08, y, f"{total} usuário(s)", va="center", color=INK, fontsize=10)
    ax1.set_yticks(list(ys), [tenant_label(t) for t in tenants], color=INK)
    ax1.invert_yaxis()
    ax1.set_xlim(0, max(left) + 1.4)
    ax1.xaxis.set_major_locator(plt.MultipleLocator(1))
    ax1.set_title("Usuários por cliente e papel", loc="left", color=INK, fontsize=13, fontweight="bold", pad=24)
    ax1.legend(ncol=3, frameon=False, loc="lower left", bbox_to_anchor=(0, 1.0), labelcolor=INK_2, fontsize=10,
               handlelength=1, handleheight=1)

    # 2) Sessões ativas por usuário (refresh tokens não expirados), cor = papel do usuário
    style(ax2)
    ordered = sorted(rows, key=lambda r: (-int(r["sessions"]), r["email"]))
    ys = range(len(ordered))
    ax2.barh(ys, [int(r["sessions"]) for r in ordered], height=0.5,
             color=[ROLES[r["role"]][1] for r in ordered])
    for y, r in zip(ys, ordered):
        ax2.text(int(r["sessions"]) + 0.1, y, str(r["sessions"]), va="center", color=INK, fontsize=10)
    ax2.set_yticks(list(ys), [r["email"] for r in ordered], color=INK)
    ax2.invert_yaxis()
    ax2.set_xlim(0, max(int(r["sessions"]) for r in ordered) + 1.2)
    ax2.xaxis.set_major_locator(plt.MultipleLocator(1))
    ax2.set_title("Sessões ativas por usuário", loc="left", color=INK, fontsize=13, fontweight="bold", pad=24)
    ax2.text(0, 1.03, "cor = papel do usuário (mesma legenda ao lado)", transform=ax2.transAxes,
             color=INK_2, fontsize=10)

    OUT.parent.mkdir(exist_ok=True)
    fig.savefig(OUT, dpi=150, facecolor=SURFACE, bbox_inches="tight")
    print(f"salvo em {OUT}")


if __name__ == "__main__":
    main()
