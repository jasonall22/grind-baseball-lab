// src/app/page.tsx

import { preload } from "react-dom";
import HeroSlider from "@/components/HeroSlider";
import { getInitialHeroData } from "@/lib/getHeroData";
import NewsUpdatesSection from "@/components/NewsUpdatesSection";
import OurTrainingFacilitySection from "@/components/OurTrainingFacilitySection";
import PricingSection from "@/components/PricingSection";
import BecomeMemberSection from "@/components/BecomeMemberSection";
import TrainersSection from "@/components/TrainersSection";
import LocalSeoSection from "@/components/LocalSeoSection";

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": ["LocalBusiness", "SportsActivityLocation"],
  "@id": "https://www.grindbaseballlab.com/#localbusiness",
  name: "The Grind Baseball Lab",
  url: "https://www.grindbaseballlab.com",
  logo: "https://www.grindbaseballlab.com/logo.png",
  image: "https://www.grindbaseballlab.com/logo.png",
  description:
    "Indoor baseball training facility in Venice, Florida offering batting cages, hitting training, HitTrax, lessons, camps, and baseball coaching.",
  telephone: "+19418002737",
  email: "info@grindbaseballlab.com",
  priceRange: "$$",
  address: {
    "@type": "PostalAddress",
    streetAddress: "613 Cypress Ave",
    addressLocality: "Venice",
    addressRegion: "FL",
    postalCode: "34285",
    addressCountry: "US",
  },
  hasMap:
    "https://www.google.com/maps/search/?api=1&query=The%20Grind%20Baseball%20Lab%2C%20613%20Cypress%20Ave%2C%20Venice%2C%20FL%2034285",
  areaServed: [
    { "@type": "City", name: "Venice" },
    { "@type": "City", name: "Englewood" },
    { "@type": "City", name: "North Port" },
    { "@type": "City", name: "Sarasota" },
  ],
  sameAs: ["https://www.facebook.com/profile.php?id=61568109854345"],
  makesOffer: [
    {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "Indoor baseball cage rentals",
        serviceType: "Baseball cages",
      },
    },
    {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "Hitting training and baseball lessons",
        serviceType: "Baseball coaching",
      },
    },
    {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "HitTrax batting cage training",
        serviceType: "Baseball training",
      },
    },
  ],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://www.grindbaseballlab.com/#website",
  name: "The Grind Baseball Lab",
  url: "https://www.grindbaseballlab.com",
  publisher: {
    "@id": "https://www.grindbaseballlab.com/#localbusiness",
  },
};

export default async function HomePage() {
  const heroData = await getInitialHeroData();
  const firstHeroImage = heroData.slides.find((slide) => slide.image_url)?.image_url;

  if (firstHeroImage) {
    preload(firstHeroImage, { as: "image", fetchPriority: "high" });
  }

  return (
    <div className="bg-white text-black">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(localBusinessJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      {/* HERO */}
      <HeroSlider initialData={heroData} />

      {/* NEWS AND UPDATES */}
      <NewsUpdatesSection />

      {/* OUR TRAINING FACILITY */}
      <OurTrainingFacilitySection />

      {/* LOCAL BASEBALL TRAINING */}
      <LocalSeoSection />

      {/* PRICING */}
      <PricingSection />

      {/* BECOME A MEMBER */}
      <BecomeMemberSection />

      {/* TRAINERS */}
      <TrainersSection />
    </div>
  );
}
