import { Button } from "@/components/ui/button";
import { SalesContactForm } from "./SalesContactForm";
import { track } from "@/lib/analytics";

/**
 * No validated testimonials exist yet — per policy, this stays honest instead
 * of fabricating names/companies/numbers. Swap for real `Testimonial` cards
 * (name, role, company, photo, quote, result, authorization) once they exist.
 */
export function TestimonialsSection() {
  return (
    <div className="border-y border-border bg-surface-2 py-14">
      <div className="mx-auto max-w-xl px-4 text-center md:px-6">
        <p className="text-base text-foreground">
          Estamos construindo o Radar Local junto com profissionais que vendem para negócios locais.
        </p>
        <SalesContactForm
          source="testimonials"
          trigger={
            <Button
              variant="outline"
              className="mt-5"
              onClick={() => track("founder_offer_viewed", { source: "testimonials" })}
            >
              Participar do acesso antecipado
            </Button>
          }
        />
      </div>
    </div>
  );
}
