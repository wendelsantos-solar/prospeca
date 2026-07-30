import { MapPin, Star, Target, Building2, TrendingUp, MessageSquare, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

export function AuthProductPreview() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-surface-2 p-8 lg:p-12">
      <div className="w-full max-w-[540px]">
        <div className="mb-8 text-center"><p className="text-display font-semibold text-foreground tracking-tight">Da busca ao próximo contato,<br />tudo em um só lugar.</p><p className="mt-3 text-body text-muted-foreground">Encontre empresas, priorize oportunidades e organize sua prospecção</p></div>
        <div className="rounded-[16px] border border-border bg-surface p-5 shadow-elevated">
          <div className="flex items-center gap-2 rounded-[10px] border border-border bg-surface-2 px-3 py-2.5 mb-4"><MapPin className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.75} /><span className="text-body-sm text-muted-foreground flex-1">Barbearias em Barra da Tijuca, RJ</span></div>
          <div className="space-y-2.5">
            <DemoLeadCard name="Rústica Barbearia" category="Barbearia" score={89} rating={4.9} hasPhone featured />
            <DemoLeadCard name="Barbearia do Zé" category="Barbearia" score={72} rating={4.6} hasPhone />
            <DemoLeadCard name="Studio Corte & Estilo" category="Salão de Beleza" score={65} rating={4.3} />
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-[10px] border border-border bg-surface-2 px-3 py-2.5"><div className="grid h-7 w-7 place-items-center rounded-md bg-primary-soft"><TrendingUp className="h-3.5 w-3.5 text-primary" strokeWidth={2} /></div><div className="flex-1"><p className="text-caption font-medium text-foreground">Pipeline ativo</p><p className="text-micro text-muted-foreground">12 leads em prospecção</p></div><span className="text-card-title font-semibold text-primary">3 novas</span></div>
        </div>
        <div className="mt-8 grid gap-3">
          <BenefitBullet icon={<Target className="h-4 w-4" strokeWidth={1.75} />} text="Encontre empresas por nicho e região" />
          <BenefitBullet icon={<TrendingUp className="h-4 w-4" strokeWidth={1.75} />} text="Entenda quais oportunidades priorizar" />
          <BenefitBullet icon={<MessageSquare className="h-4 w-4" strokeWidth={1.75} />} text="Organize leads e próximas ações" />
        </div>
      </div>
    </div>
  );
}

function DemoLeadCard({ name, category, score, rating, hasPhone, featured }: { name: string; category: string; score: number; rating: number; hasPhone?: boolean; featured?: boolean }) {
  return (<div className={cn("flex items-center gap-3 rounded-[10px] border px-3 py-2.5", featured ? "border-primary/20 bg-primary-subtle" : "border-border bg-surface")}><div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-md", featured ? "bg-primary-soft" : "bg-surface-2")}><Building2 className={cn("h-4 w-4", featured ? "text-primary" : "text-muted-foreground")} strokeWidth={1.75} /></div><div className="flex-1 min-w-0"><p className="text-body-sm font-medium text-foreground truncate">{name}</p><p className="text-caption text-muted-foreground">{category}</p></div><div className="flex items-center gap-1.5 shrink-0"><Target className={cn("h-3.5 w-3.5", score>=80?"text-hot":score>=60?"text-warning":"text-muted-foreground")} strokeWidth={2} /><span className="text-body-sm font-semibold tabular-nums">{score}</span></div><div className="flex items-center gap-1 shrink-0"><Star className="h-3.5 w-3.5 text-warning" fill="currentColor" strokeWidth={1.5} /><span className="text-caption tabular-nums">{rating}</span></div>{hasPhone && <Phone className="h-3.5 w-3.5 text-success shrink-0" strokeWidth={1.75} />}</div>);
}

function BenefitBullet({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex items-center gap-2.5 text-body-sm text-muted-foreground"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">{icon}</span>{text}</div>;
}
