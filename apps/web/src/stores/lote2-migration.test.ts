import { test, expect } from "bun:test";
import { useSettingsStore, useUIStore } from "./index";
import { MAX_RADIUS_KM } from "@/lib/nearest-outside";

// LOTE 2, Tarefa 1 — o raio para de mentir: ceo do slider foi de 100 para
// MAX_RADIUS_KM (50, teto real do Places API). Estado salvo ANTES disso não
// pode virar estado inválido silencioso (defaultRadius > slider.max).
test("useSettingsStore.set clampa defaultRadius acima do novo teto", () => {
  useSettingsStore.getState().set({ defaultRadius: 100 });
  expect(useSettingsStore.getState().defaultRadius).toBe(MAX_RADIUS_KM);
});

test("useSettingsStore.set não mexe em defaultRadius quando o patch não o inclui", () => {
  useSettingsStore.getState().set({ defaultRadius: 20 });
  useSettingsStore.getState().set({ userName: "Ana" });
  expect(useSettingsStore.getState().defaultRadius).toBe(20);
  expect(useSettingsStore.getState().userName).toBe("Ana");
});

test("useSettingsStore migrate (v0→v1) clampa blob persistido com defaultRadius > teto", () => {
  const migrate = useSettingsStore.persist.getOptions().migrate!;
  const migrated = migrate({ defaultRadius: 100, userName: "Bia" }, 0) as {
    defaultRadius: number;
    userName: string;
  };
  expect(migrated.defaultRadius).toBe(MAX_RADIUS_KM);
  expect(migrated.userName).toBe("Bia"); // resto do blob preservado
});

test("useSettingsStore migrate não altera defaultRadius já dentro do teto", () => {
  const migrate = useSettingsStore.persist.getOptions().migrate!;
  const migrated = migrate({ defaultRadius: 20 }, 0) as { defaultRadius: number };
  expect(migrated.defaultRadius).toBe(20);
});

// LOTE 2, Tarefa 4 — "territories" saiu do tipo de discoveryView. Blob
// persistido com esse valor (ou qualquer coisa fora do contrato atual) não
// pode virar tela em branco: cai em "map".
test("useUIStore migrate (v2→v3) rebaixa discoveryView='territories' para 'map'", () => {
  const migrate = useUIStore.persist.getOptions().migrate!;
  const migrated = migrate({ discoveryView: "territories", navMode: "collapsed" }, 2) as {
    discoveryView: string;
    navMode: string;
  };
  expect(migrated.discoveryView).toBe("map");
  expect(migrated.navMode).toBe("collapsed"); // migração de navMode (Fase 6b) continua intacta
});

test("useUIStore migrate preserva discoveryView válido", () => {
  const migrate = useUIStore.persist.getOptions().migrate!;
  const migrated = migrate({ discoveryView: "heatmap" }, 2) as { discoveryView: string };
  expect(migrated.discoveryView).toBe("heatmap");
});

test("useUIStore migrate rebaixa discoveryView ausente/corrompido para 'map'", () => {
  const migrate = useUIStore.persist.getOptions().migrate!;
  expect((migrate({}, 0) as { discoveryView: string }).discoveryView).toBe("map");
  expect((migrate({ discoveryView: 42 }, 0) as { discoveryView: string }).discoveryView).toBe(
    "map",
  );
});
