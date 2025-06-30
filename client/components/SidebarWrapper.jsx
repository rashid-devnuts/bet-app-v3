'use client';

import { useCustomSidebar } from '../contexts/SidebarContext.js';
import Sidebar from '@/components/home/Sidebar';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';

const SidebarWrapper = () => {
    const { isCollapsed, isMobile, isMobileOpen, setIsMobileOpen } = useCustomSidebar();

    //INFO: Mobile sidebar using Sheet
    if (isMobile) {
        return (
            <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                <SheetContent
                    side="left"
                    className="w-64 p-0 bg-gray-800"
                >
                    <SheetTitle className="sr-only">
                        Navigation Menu
                    </SheetTitle>
                    <SheetDescription className="sr-only">
                        Main navigation sidebar with sports betting options
                    </SheetDescription>
                    <Sidebar />
                </SheetContent>
            </Sheet>
        );
    }

    // Desktop sidebar
    return (
        <div className={`hidden lg:block lg:h-[calc(100vh-108px)] lg:z-10 transition-all duration-300 ${isCollapsed ? 'lg:w-16' : 'lg:w-56'
            }`}>
            <Sidebar />
        </div>
    );
};

export default SidebarWrapper;
