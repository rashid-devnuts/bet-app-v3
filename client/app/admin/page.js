'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import UserManagement from '@/components/admin/UserManagement';
import { fetchUserStats, selectUserStats, selectIsLoading } from '@/lib/features/admin/adminUserSlice';
import { selectUser, selectIsAuthenticated } from '@/lib/features/auth/authSlice';
import { User, Users, CalendarDays, Search, Sliders, X, Shield, Filter, UserCheck, Clock } from 'lucide-react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

export default function AdminDashboard() {
  const dispatch = useDispatch();
  const router = useRouter();
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const stats = useSelector(selectUserStats);
  const loading = useSelector(selectIsLoading);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [activeFilters, setActiveFilters] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    if (user?.role !== 'admin') {
      router.push('/');
      return;
    }

    dispatch(fetchUserStats());
  }, [dispatch, user, isAuthenticated, router]);

  const resetFilters = () => {
    setStatusFilter("all");
    setRoleFilter("all");
    setActiveFilters(0);
  };

  const applyFilters = () => {
    let count = 0;
    if (statusFilter !== "all") count++;
    if (roleFilter !== "all") count++;
    setActiveFilters(count);
    setFilterDrawerOpen(false);
  };

  if (!isAuthenticated || !user) {
    return null; // Will redirect in useEffect
  }

  if (user.role !== 'admin') {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <header className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-4 md:mb-0">User Dashboard</h1>
            <div className="flex gap-3 items-center">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 h-10 rounded-none border-gray-200 bg-white"
                />
              </div>
              
              <Drawer open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen} direction="right">
                <DrawerTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-10 w-10 rounded-none relative"
                  >
                    <Sliders className="h-4 w-4" />
                    {activeFilters > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center">
                        {activeFilters}
                      </span>
                    )}
                  </Button>
                </DrawerTrigger>
                <DrawerContent className="right-0 h-full w-80 sm:w-96 rounded-l-xl fixed shadow-xl border-0">
                  <div className="h-full flex flex-col bg-white">
                    <DrawerHeader className="border-b border-gray-100 px-6 py-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <DrawerTitle className="text-xl font-semibold text-gray-900">Filters</DrawerTitle>
                          <DrawerDescription className="text-sm text-gray-500 mt-1">
                            Refine your user list
                          </DrawerDescription>
                        </div>
                        <DrawerClose asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                            <X className="h-4 w-4" />
                          </Button>
                        </DrawerClose>
                      </div>
                    </DrawerHeader>
                    
                    <div className="flex-1 overflow-y-auto">
                      <div className="px-6 py-4 space-y-6">
                        {/* Status Filter */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium flex items-center gap-2 text-gray-700">
                              <User className="h-4 w-4 text-gray-500" />
                              Status
                            </label>
                            {statusFilter !== 'all' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                                onClick={() => setStatusFilter('all')}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Clear
                              </Button>
                            )}
                          </div>
                          
                          <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger 
                              className={`w-full h-10 px-3 hover:bg-transparent cursor-pointer rounded-none ${statusFilter !== 'all' ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50' : ''}`}
                            >
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent className="border border-gray-200 shadow-lg rounded-lg">
                              <SelectItem value="all" className="py-2 px-3">All Users</SelectItem>
                              <SelectItem value="active" className="py-2 px-3 text-emerald-600">Active</SelectItem>
                              <SelectItem value="inactive" className="py-2 px-3 text-rose-600">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Role Filter */}
                        <div className="space-y-3 pt-2 border-t border-gray-100">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium flex items-center gap-2 text-gray-700">
                              <Shield className="h-4 w-4 text-gray-500" />
                              Role
                            </label>
                            {roleFilter !== 'all' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                                onClick={() => setRoleFilter('all')}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Clear
                              </Button>
                            )}
                          </div>
                          
                          <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger 
                              className={`w-full h-10 px-3 hover:bg-transparent cursor-pointer rounded-none ${roleFilter !== 'all' ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50' : ''}`}
                            >
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent className="border border-gray-200 shadow-lg rounded-lg">
                              <SelectItem value="all" className="py-2 px-3">All Roles</SelectItem>
                              <SelectItem value="admin" className="py-2 px-3">Admin</SelectItem>
                              <SelectItem value="user" className="py-2 px-3">User</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    
                    <div className="border-t border-gray-100 p-6 bg-gray-50">
                      <div className="flex flex-col gap-3">
                        <Button 
                          onClick={applyFilters}
                          className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          Apply Filters
                          {activeFilters > 0 && (
                            <span className="ml-2 h-5 w-5 rounded-full bg-white text-emerald-600 text-xs flex items-center justify-center">
                              {activeFilters}
                            </span>
                          )}
                        </Button>
                        
                        <Button 
                          variant="ghost" 
                          onClick={resetFilters}
                          className="w-full h-10 text-gray-700 hover:bg-gray-200 transition-colors"
                        >
                          Reset All
                        </Button>
                      </div>
                    </div>
                  </div>
                </DrawerContent>
              </Drawer>
            </div>
          </div>
        </header>
        
        {/* Active Filters Display */}
        {activeFilters > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {statusFilter !== 'all' && (
              <Badge variant="secondary" className="flex items-center gap-1 py-1 px-3">
                <span>Status: {statusFilter === 'active' ? 'Active' : 'Inactive'}</span>
                <button 
                  className="ml-1 cursor-pointer"
                  onClick={() => {
                    setStatusFilter('all');
                    // Recalculate active filters
                    let count = 0;
                    if (roleFilter !== 'all') count++;
                    setActiveFilters(count);
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            
            {roleFilter !== 'all' && (
              <Badge variant="secondary" className="flex items-center gap-1 py-1 px-3">
                <span>Role: {roleFilter.charAt(0).toUpperCase() + roleFilter.slice(1)}</span>
                <button 
                  className="ml-1 cursor-pointer"
                  onClick={() => {
                    setRoleFilter('all');
                    // Recalculate active filters
                    let count = 0;
                    if (statusFilter !== 'all') count++;
                    setActiveFilters(count);
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs h-7"
              onClick={resetFilters}
            >
              Clear all
            </Button>
          </div>
        )}
        
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5 mb-8">
          <Card className="bg-white rounded-none shadow-sm border-0 overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="px-5 py-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-600 mb-1">Total Users</p>
                  <p className="text-2xl font-bold text-gray-900">{loading ? '...' : stats?.totalUsers}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white rounded-none shadow-sm border-0 overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="px-5 py-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-emerald-600 mb-1">Active Users</p>
                  <p className="text-2xl font-bold text-gray-900">{loading ? '...' : stats?.activeUsers}</p>
                  <p className="text-xs text-gray-500">
                    {loading ? '...' : `${stats?.percentageActive}% of total users`}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center">
                  <UserCheck className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white rounded-none shadow-sm border-0 overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="px-5 py-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-purple-600 mb-1">Recent Users</p>
                  <p className="text-2xl font-bold text-gray-900">{loading ? '...' : stats?.recentUsers}</p>
                  <p className="text-xs text-gray-500">Last 30 days</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-purple-50 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User Management Section */}
        <div className="mt-8">
          <UserManagement 
            searchQuery={searchQuery} 
            statusFilter={statusFilter}
            roleFilter={roleFilter}
          />
        </div>
      </div>
    </div>
  );
}