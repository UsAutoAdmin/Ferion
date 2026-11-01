/** Single source of truth for top-level navigation. */
export interface NavItem {
  label: string;
  href: string;
}

export const primaryNavItems: NavItem[] = [
  { label: "Vehicle Value", href: "/value" },
  { label: "Auction Analysis", href: "/auctions" },
  { label: "Catalog", href: "/catalog" },
  { label: "Yards", href: "/yards" },
];
