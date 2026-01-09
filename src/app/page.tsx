import HeroSlider from "@/components/HeroSlider";
import NewsUpdatesSection from "@/components/NewsUpdatesSection";
import OurTrainingFacilitySection from "@/components/OurTrainingFacilitySection";
import PricingSection from "@/components/PricingSection";
import BecomeMemberSection from "@/components/BecomeMemberSection";
import TrainersSection from "@/components/TrainersSection";

export default function HomePage() {
  return (
    <div className="bg-white text-black">
      {/* HERO */}
      <HeroSlider />

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
