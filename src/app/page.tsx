// src/app/page.tsx

import { preload } from "react-dom";
import HeroSlider from "@/components/HeroSlider";
import { getInitialHeroData } from "@/lib/getHeroData";
import NewsUpdatesSection from "@/components/NewsUpdatesSection";
import OurTrainingFacilitySection from "@/components/OurTrainingFacilitySection";
import PricingSection from "@/components/PricingSection";
import BecomeMemberSection from "@/components/BecomeMemberSection";
import TrainersSection from "@/components/TrainersSection";

export default async function HomePage() {
  const heroData = await getInitialHeroData();
  const firstHeroImage = heroData.slides.find((slide) => slide.image_url)?.image_url;

  if (firstHeroImage) {
    preload(firstHeroImage, { as: "image", fetchPriority: "high" });
  }

  return (
    <div className="bg-white text-black">
      {/* HERO */}
      <HeroSlider initialData={heroData} />

      {/* NEWS AND UPDATES */}
      <NewsUpdatesSection />

      {/* OUR TRAINING FACILITY */}
      <OurTrainingFacilitySection />

      {/* PRICING */}
      <PricingSection />

      {/* BECOME A MEMBER */}
      <BecomeMemberSection />

      {/* TRAINERS */}
      <TrainersSection />
    </div>
  );
}
