/**
 * No real case study exists yet — per policy, don't fabricate numbers.
 * Flip this to render the real structure (Perfil/Objetivo/Região/
 * Oportunidades/Abordagens/Respostas/Reuniões/Clientes ganhos) once a pilot
 * produces real data.
 */
const CASE_STUDY_ENABLED = false;

export function CaseStudySection() {
  if (!CASE_STUDY_ENABLED) return null;
  return null;
}
