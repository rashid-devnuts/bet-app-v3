"use client";

import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import {
  MoreHorizontal,
  Search,
  Plus,
  Trash2,
  Trophy,
  History,
  Eye,
  Sliders,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  Shield,
  UserPlus,
  User,
  ArrowUpDown,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  fetchUsers,
  searchUsers,
  updateUserStatus,
  deleteUser,
  selectAdminUsers,
  selectPagination,
  selectIsLoading,
  selectError,
  selectMessage,
} from "@/lib/features/admin/adminUserSlice";
import CreateUserDialog from "./CreateUserDialog";
import { useRouter } from "next/navigation";

export default function UserManagement({ searchQuery = "", statusFilter = "all", roleFilter = "all" }) {
  const router = useRouter();
  const dispatch = useDispatch();
  const users = useSelector(selectAdminUsers);
  const pagination = useSelector(selectPagination);
  const loading = useSelector(selectIsLoading);
  const error = useSelector(selectError);
  const message = useSelector(selectMessage);
  
  // State
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  // Initial load
  useEffect(() => {
    dispatch(fetchUsers({ page: 1, limit: 10 }));
  }, [dispatch]);

  // Effect to handle search query changes from parent
  useEffect(() => {
    if (searchQuery.trim()) {
      dispatch(searchUsers(searchQuery));
    } else if (searchQuery === "") {
      dispatch(fetchUsers());
    }
  }, [searchQuery, dispatch]);
  
  // Handlers
  const handleStatusChange = (userId, newStatus) => {
    dispatch(updateUserStatus({ userId, isActive: newStatus }));
  };

  const handleDeleteUser = (user) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (userToDelete) {
      try {
        await dispatch(deleteUser(userToDelete._id)).unwrap();
        setDeleteDialogOpen(false);
        setUserToDelete(null);
        dispatch(fetchUsers({ page: 1, limit: 10 }));
      } catch (error) {
        console.error("Failed to delete user:", error);
      }
    }
  };

  const cancelDeleteUser = () => {
    setDeleteDialogOpen(false);
    setUserToDelete(null);
  };
  
  // Filter users
  const filteredUsers = users.filter((user) => {
    // Filter by status
    if (statusFilter !== "all") {
      if (statusFilter === "active" && !user.isActive) return false;
      if (statusFilter === "inactive" && user.isActive) return false;
    }
    
    // Filter by role
    if (roleFilter !== "all" && user.role !== roleFilter) return false;
    
    // Filter by search query
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
      return (
        fullName.includes(query) ||
        user.email.toLowerCase().includes(query) ||
        (user.phoneNumber && user.phoneNumber.includes(query))
      );
    }
    
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header with Create User Button */}
      <header className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-4 md:mb-0">User Management</h1>
          <div className="flex gap-3 items-center">
            <Button
              onClick={() => setShowCreateUserDialog(true)}
              className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-none px-4"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Create User
            </Button>
          </div>
        </div>
      </header>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 border-l-4 border-red-500 mb-6">
          {error}
        </div>
      )}
      
      {/* Success Message */}
      {message && (
        <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700 border-l-4 border-green-500 mb-6">
          {message}
        </div>
      )}
      
      {/* Users Table */}
      <Card className="rounded-none shadow-none px-2 py-2">
        <CardContent className="p-1">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 text-[13px]">
                  <TableHead className="cursor-pointer select-none">
                    <div className="flex items-center gap-2">
                      Name
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none">
                    <div className="flex items-center gap-2">
                      Email
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none">
                    <div className="flex items-center gap-2">
                      Phone
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none">
                    <div className="flex items-center gap-2">
                      Status
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none">
                    <div className="flex items-center gap-2">
                      Role
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <div className="animate-spin h-8 w-8 border-4 border-gray-200 rounded-full border-t-blue-600 mb-2"></div>
                        <p>Loading users...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <Search className="h-8 w-8 text-gray-300 mb-2" />
                        <p>No users found</p>
                        <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filter</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user._id} className="hover:bg-gray-50 text-[13px]">
                      <TableCell className="font-medium">
                        {user.firstName} {user.lastName}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.phoneNumber}</TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? "success" : "destructive"} className={user.isActive ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' : 'bg-rose-100 text-rose-800 hover:bg-rose-100'}>
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.role === "admin" ? "default" : "secondary"}
                          className={user.role === "admin" ? 'bg-blue-100 text-blue-800 hover:bg-blue-100' : 'bg-gray-100 text-gray-800 hover:bg-gray-100'}
                        >
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick= {()=>{router.push("/betting-history")}}
                            >
                              <History className="h-4 w-4 mr-2" />
                              View Betting History
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                (window.location.href = `/admin/users/${user._id}`)
                              }
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteUser(user)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        
        {/* Pagination */}
        {filteredUsers.length > 0 && (
          <div className="flex justify-between items-center mt-4 pt-4 border-t">
            <div className="text-sm text-gray-600">
              Showing {filteredUsers.length} of {pagination.totalUsers} users
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => dispatch(fetchUsers({ page: pagination.currentPage - 1, limit: 10 }))}
                disabled={pagination.currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center">
                {Array.from({ length: Math.min(pagination.totalPages || 1, 5) }).map((_, i) => {
                  let pageNum;
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (pagination.currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (pagination.currentPage >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = pagination.currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={i}
                      variant={pagination.currentPage === pageNum ? "default" : "outline"}
                      size="icon"
                      className="h-8 w-8 mx-0.5"
                      onClick={() => dispatch(fetchUsers({ page: pageNum, limit: 10 }))}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => dispatch(fetchUsers({ page: pagination.currentPage + 1, limit: 10 }))}
                disabled={pagination.currentPage === pagination.totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Create User Dialog */}
      <CreateUserDialog
        isOpen={showCreateUserDialog}
        onClose={() => setShowCreateUserDialog(false)}
      />
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">
                {userToDelete?.firstName} {userToDelete?.lastName}
              </span>
              ? This action cannot be undone and will permanently remove the
              user from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDeleteUser}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
