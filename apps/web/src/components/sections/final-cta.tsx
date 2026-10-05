import { site } from "@/lib/site";
import { GitHubIcon, Mascot } from "../ui/brand";
import { Container, PrimaryButton } from "../ui/primitives";

export function FinalCta() {
  return (
    <section>
      <Container className="pt-10 pb-24 lg:pb-[120px]">
        <div className="flex flex-col items-center gap-10 rounded-[28px] border border-accent/20 bg-[radial-gradient(ellipse_at_85%_20%,#f2a93b40_0%,#17140f_60%)] px-8 py-14 md:flex-row md:px-[72px] md:py-20">
          <div className="flex flex-1 flex-col gap-6">
            <h2 className="font-display text-4xl leading-[1.04] font-bold tracking-[-0.03em] sm:text-5xl lg:text-[56px]">
              Put a meerkat on lookout
              <br className="hidden lg:block" /> for your next customer.
            </h2>
            <p className="text-lg text-muted">Self-host in one command, or start on Meerko Cloud with 1,000 free credits.</p>
            <div className="flex flex-wrap gap-3">
              <PrimaryButton href={site.signupUrl}>Get started free</PrimaryButton>
              <a
                href={site.githubUrl}
                className="inline-flex items-center gap-2 rounded-[10px] border border-line bg-white/[0.03] px-6 py-4 text-base font-semibold transition hover:border-muted"
              >
                <GitHubIcon className="size-[18px]" />
                Star on GitHub
              </a>
            </div>
          </div>
          <Mascot className="h-[200px] w-auto md:h-[260px]" />
        </div>
      </Container>
    </section>
  );
}
