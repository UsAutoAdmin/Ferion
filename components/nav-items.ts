/**
 * Single source of truth for top-level navigation. The header and any
 * index redirects read from here so they can't drift apart.
 */
export interface NavItem {
  label: string;
  href: string;
  description?: string;
}

export const primaryNavItems: NavItem[] = [
  {
    label: "Vehicle Value",
    href: "/value",
    description: "Year, make, model in; scrap value and the resellable parts worth pulling out.",
  },
  {
    label: "Auction Analysis",
    href: "/auctions",
    description: "Upload a Copart or IAA sale list and value every lot against the parts catalog.",
  },
  {
    label: "Catalog",
    href: "/catalog",
    description: "The canonical parts catalog: sell-through, pricing, and fitment coverage.",
  },
  {
    label: "Yards",
    href: "/yards",
    description: "Monitored yard inventory and scheduled scans.",
  },
];
