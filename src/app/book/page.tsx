import type { Metadata } from "next";

import CustomerBookingApp from "@/components/booking/CustomerBookingApp";

export const metadata: Metadata = {
  title: "Book Online | The Grind Baseball Lab",
  description: "Book cage time, lessons, camps, and training at The Grind Baseball Lab.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function BookPage() {
  return <CustomerBookingApp />;
}
