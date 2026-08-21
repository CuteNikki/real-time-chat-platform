// Single source of truth for the legal entity details shown across the Privacy
// Policy, Terms & Conditions and Imprint pages. Replace the bracketed
// placeholder values below with your real operator information before launch —
// an imprint in particular must contain accurate, legally required details.
type LegalInfo = {
  siteName: string;
  operatorName: string;
  address: { line1: string; line2: string; country: string };
  contactEmail: string;
  phone: string;
  jurisdiction: string;
  effectiveDate: string;
};

export const LEGAL: LegalInfo = {
  siteName: 'Orbit',
  operatorName: 'Nikki Sophie Berthold',
  address: {
    line1: 'Friedrich-Karl-Straße 28',
    line2: '32584 Löhne',
    country: 'Germany',
  },
  phone: '+49 176 46236314',
  contactEmail: 'orbit@niso.moe',
  // Governing law used in the Terms & Conditions.
  jurisdiction: 'Germany',
  // Shown as the "last updated" date on every legal page.
  effectiveDate: 'August 21, 2026',
};
