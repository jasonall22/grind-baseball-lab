export type WebsiteSettings = {
  key: string;
  site_name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  facebook_url: string;
};

export const DEFAULT_WEBSITE_SETTINGS: WebsiteSettings = {
  key: "default",
  site_name: "The Grind Baseball Lab",
  email: "info@grindbaseballlab.com",
  phone: "(941) 307-7362",
  address_line1: "613 Cypress Ave",
  address_line2: "Venice, FL 34285",
  facebook_url: "https://www.facebook.com/profile.php?id=61568109854345",
};

export function telephoneHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `tel:+${digits.length === 10 ? "1" : ""}${digits}`;
}
