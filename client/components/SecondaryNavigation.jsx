"use client"
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Home, Clock, PlayCircle, Search, Calendar } from "lucide-react"

const SecondaryNavigation = () => {
    const pathname = usePathname()

    const getActiveTab = (pathname) => {
        if (pathname === '/') return 'HOME';
        if (pathname === '/today') return 'TODAY';
        if (pathname === '/inplay') return 'IN-PLAY';
        if (pathname.includes('/upcoming')) return 'UPCOMING';
        return 'HOME'; // Default to HOME
    }

    const activeTab = getActiveTab(pathname)

    const navigationItems = [
        { icon: <Home className="h-3 w-3" />, label: "HOME", href: "/" },
        { icon: <Calendar className="h-3 w-3" />, label: "TODAY", href: "/today" },
        { icon: <PlayCircle className="h-3 w-3" />, label: "IN-PLAY", href: "/inplay" },
        { icon: <Clock className="h-3 w-3" />, label: "UPCOMING", href: "/upcoming" },
    ];

    return (
        <div className="bg-slate-800 text-white sticky top-0 z-30 py-2">
            {/* Unified Navigation View for all screen sizes */}
            <div className="px-4">
                <div className="flex items-center justify-between">
                    {/* Navigation items container */}
                    <div className="flex items-center space-x-2 sm:space-x-3">
                        {navigationItems.map((item, index) => (
                            <NavItem
                                key={index}
                                icon={item.icon}
                                label={item.label}
                                href={item.href}
                                active={activeTab === item.label} // Simplified active logic
                            />
                        ))}
                    </div>
                    {/* Search icon container */}
                    {/* <div className="flex items-center">
                        <Search className="h-4 w-4 cursor-pointer" />
                    </div> */}
                </div>
            </div>
        </div>
    )
}

const NavItem = ({ icon, label, href, active = false }) => {
    const content = (
        <div
            className={`flex items-center space-x-1 px-2 py-1 rounded-3xl transition-colors ${active ? "bg-emerald-600 text-white" : "hover:bg-slate-700 text-slate-200"
                } cursor-pointer whitespace-nowrap`}
        >
            {icon}
            <span className="text-xs font-medium">{label}</span> {/* Always display full label */}
        </div>
    )

    if (href) {
        return <Link href={href}>{content}</Link>
    }

    return content
}

export default SecondaryNavigation
