import { AgentSuperpowers } from "@/components/sections/agent-superpowers";
import { FinalCta } from "@/components/sections/final-cta";
import { Footer } from "@/components/sections/footer";
import { GtmEngineers } from "@/components/sections/gtm-engineers";
import { Hero } from "@/components/sections/hero";
import { Nav } from "@/components/sections/nav";
import { OpenSource } from "@/components/sections/open-source";
import { Problem } from "@/components/sections/problem";
import { WorksWith } from "@/components/sections/works-with";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <WorksWith />
        <Problem />
        <AgentSuperpowers />
        <OpenSource />
        <GtmEngineers />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
