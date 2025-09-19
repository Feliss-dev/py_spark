"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Upload,
  BarChart3,
  TrendingUp,
  FileText,
  Database,
  PieChart,
  LineChart,
  DollarSign,
  Home,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "Data Management",
    items: [
      {
        title: "Upload Data",
        url: "/upload",
        icon: Upload,
      },
      {
        title: "Data Processing",
        url: "/processing",
        icon: Database,
      },
    ],
  },
  {
    title: "Analytics",
    items: [
      {
        title: "Sales Analysis",
        url: "/analytics/sales",
        icon: BarChart3,
      },
      {
        title: "Price Modeling",
        url: "/analytics/pricing",
        icon: DollarSign,
      },
      {
        title: "Efficiency Metrics",
        url: "/analytics/efficiency",
        icon: TrendingUp,
      },
      {
        title: "Comprehensive Analysis",
        url: "/analytics/comprehensive",
        icon: PieChart,
      },
    ],
  },
  {
    title: "Reports",
    items: [
      {
        title: "Job Status",
        url: "/reports/jobs",
        icon: FileText,
      },
      {
        title: "Export Results",
        url: "/reports/export",
        icon: LineChart,
      },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="p-4">
        <div className="flex items-center space-x-2">
          <Database className="h-6 w-6 text-blue-600" />
          <span className="font-bold text-lg">BigData Analytics</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {menuItems.map((section, index) => (
          <SidebarGroup key={index}>
            {section.title && section.items ? (
              <>
                <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          className={cn(
                            "w-full",
                            pathname === item.url && "bg-blue-100 text-blue-700"
                          )}
                        >
                          <Link
                            href={item.url}
                            className="flex items-center space-x-2"
                          >
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </>
            ) : (
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      className={cn(
                        "w-full",
                        pathname === section.url && "bg-blue-100 text-blue-700"
                      )}
                    >
                      <Link
                        href={section.url!}
                        className="flex items-center space-x-2"
                      >
                        <section.icon className="h-4 w-4" />
                        <span>{section.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            )}
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="text-xs text-muted-foreground">
          © 2024 BigData Platform
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
