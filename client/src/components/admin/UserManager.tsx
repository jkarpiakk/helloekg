import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Search, Shield, Eye, Ban, CheckCircle, UserX, Mail, Edit } from "lucide-react";
import type { User } from "@shared/schema";

interface UserStats {
  totalUsers: number;
  activeSubscriptions: number;
  newUsersThisMonth: number;
}

export default function UserManager() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const { t } = useTranslation();
  const { toast } = useToast();

  // Fetch users with filters
  const { data: users, isLoading } = useQuery({
    queryKey: ["/api/admin/users", searchQuery, roleFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      
      const response = await apiRequest("GET", `/api/admin/users?${params}`);
      return response.json() as Promise<User[]>;
    },
  });

  // Fetch user statistics
  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats/users"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/stats/users");
      return response.json() as Promise<UserStats>;
    },
  });

  // Update user status mutation
  const updateUserStatusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      const response = await apiRequest("PUT", `/api/admin/users/${userId}`, { status });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Status użytkownika został zaktualizowany",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats/users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zaktualizować statusu użytkownika",
        variant: "destructive",
      });
    },
  });

  // Update user role mutation
  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const response = await apiRequest("PUT", `/api/admin/users/${userId}`, { role });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Rola użytkownika została zaktualizowana",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zaktualizować roli użytkownika",
        variant: "destructive",
      });
    },
  });

  const getRoleBadge = (role: string) => {
    const colors = {
      student: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      reviewer: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", 
      admin: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      owner: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };

    return (
      <Badge className={colors[role as keyof typeof colors] || colors.student}>
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </Badge>
    );
  };

  const getStatusBadge = (emailVerified: boolean, subscription?: any) => {
    if (!emailVerified) {
      return <Badge variant="outline" className="text-yellow-600">Niezweryfikowany</Badge>;
    }
    if (subscription?.status === "active") {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Aktywna subskrypcja</Badge>;
    }
    return <Badge variant="secondary">Zweryfikowany</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Zarządzanie użytkownikami</h2>
          <p className="text-muted-foreground">
            Moderacja użytkowników, zarządzanie rolami i subskrypcjami
          </p>
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Wszyscy użytkownicy</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aktywne subskrypcje</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Nowi w tym miesiącu</CardTitle>
              <UserX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.newUsersThisMonth}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Wyszukaj użytkownika
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Email, imię lub nazwisko..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="search-users"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Rola
              </label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger data-testid="role-filter">
                  <SelectValue placeholder="Wszystkie role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie role</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="reviewer">Reviewer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Status
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="status-filter">
                  <SelectValue placeholder="Wszystkie statusy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie statusy</SelectItem>
                  <SelectItem value="verified">Zweryfikowani</SelectItem>
                  <SelectItem value="unverified">Niezweryfikowani</SelectItem>
                  <SelectItem value="active">Aktywna subskrypcja</SelectItem>
                  <SelectItem value="inactive">Brak subskrypcji</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="users-table">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-4 font-semibold text-foreground">Użytkownik</th>
                  <th className="text-left p-4 font-semibold text-foreground">Rola</th>
                  <th className="text-left p-4 font-semibold text-foreground">Status</th>
                  <th className="text-left p-4 font-semibold text-foreground">Data rejestracji</th>
                  <th className="text-left p-4 font-semibold text-foreground">Ostatnia aktywność</th>
                  <th className="text-left p-4 font-semibold text-foreground">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users?.map((user) => (
                  <tr key={user.id} className="hover:bg-secondary/50" data-testid={`user-row-${user.id}`}>
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium">
                            {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">
                            {user.firstName} {user.lastName}
                          </h4>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="p-4">
                      {getStatusBadge(user.emailVerified)}
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString('pl-PL')}
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('pl-PL') : 'Nigdy'}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => {
                            setSelectedUser(user);
                            setShowUserDetails(true);
                          }}
                          data-testid={`view-user-${user.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          data-testid={`edit-user-${user.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {user.role !== "owner" && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => updateUserStatusMutation.mutate({ 
                              userId: user.id, 
                              status: user.emailVerified ? "suspended" : "verified" 
                            })}
                            disabled={updateUserStatusMutation.isPending}
                            data-testid={`toggle-user-${user.id}`}
                          >
                            {user.emailVerified ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {users?.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Brak użytkowników</h3>
            <p className="text-muted-foreground">
              Nie znaleziono użytkowników spełniających kryteria wyszukiwania
            </p>
          </CardContent>
        </Card>
      )}

      {/* User Details Dialog */}
      <Dialog open={showUserDetails} onOpenChange={setShowUserDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Szczegóły użytkownika</DialogTitle>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Imię i nazwisko</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedUser.firstName} {selectedUser.lastName}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Rola</label>
                  <div className="mt-1">
                    {getRoleBadge(selectedUser.role)}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Zawód</label>
                  <p className="text-sm text-muted-foreground">{selectedUser.profession || "Nie podano"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Data rejestracji</label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedUser.createdAt).toLocaleDateString('pl-PL')}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Ostatnie logowanie</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleDateString('pl-PL') : 'Nigdy'}
                  </p>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <Button
                  onClick={() => setShowUserDetails(false)}
                  variant="outline"
                >
                  Zamknij
                </Button>
                <Button
                  onClick={() => {
                    // TODO: Implement email functionality
                    toast({
                      title: "Informacja",
                      description: "Funkcja wysyłania wiadomości będzie dostępna wkrótce",
                    });
                  }}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Wyślij wiadomość
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}