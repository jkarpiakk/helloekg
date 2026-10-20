import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useTranslation } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Search, Shield, Eye, Ban, CheckCircle, UserX, Mail, Edit, UserPlus, CreditCard } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { User } from "@shared/schema";

/** Błąd z apiRequest ma postać „<status>: <treść>”; treść to zwykle JSON { error } */
function parseApiError(error: unknown): { status: number | null; message: string | null } {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const m = raw.match(/^(\d{3}):\s*([\s\S]*)$/);
  if (!m) return { status: null, message: raw || null };
  let message: string | null = m[2] || null;
  try {
    const body = JSON.parse(m[2]);
    if (body && typeof body.error === "string") message = body.error;
  } catch {
    /* treść nie jest JSON-em */
  }
  return { status: Number(m[1]), message };
}

type UserAction = "status" | "role" | "subscription" | "create";

/** Kody serwera → konkretny komunikat: co się stało i co zrobić */
function describeUserError(error: unknown, action: UserAction): string {
  const { status, message } = parseApiError(error);
  switch (status) {
    case 400:
      if (action === "subscription") return "Czas subskrypcji musi wynosić od 1 do 24 miesięcy.";
      if (action === "create") return message ?? "Sprawdź dane: e-mail, hasło (8–128 znaków), imię, nazwisko i rolę.";
      return message ?? "Nieprawidłowa rola lub status. Odśwież stronę i spróbuj ponownie.";
    case 401:
      return "Sesja wygasła. Zaloguj się ponownie.";
    case 403:
      // Serwer mówi, czego brakuje (np. „Tylko właściciel może…”, „Nie możesz zmieniać własnej roli”)
      return `${message ?? "Nie masz uprawnień do tej operacji"}.`.replace(/\.\.$/, ".");
    case 404:
      return "Nie znaleziono tego konta — mogło zostać usunięte. Odśwież listę.";
    case 409:
      return `${message ?? "To ostatni właściciel"}. Najpierw nadaj rolę właściciela innemu kontu.`.replace(/\.\. /, ". ");
    default:
      return message && status !== null && status < 500
        ? message
        : "Coś poszło nie tak po stronie serwera. Spróbuj ponownie za chwilę.";
  }
}

const formatDate = (value: unknown) => (value ? new Date(value as string).toLocaleDateString("pl-PL") : null);

interface UserStats {
  totalUsers: number;
  activeSubscriptions: number;
  newUsersThisMonth: number;
}

const createUserSchema = z.object({
  email: z.string().email("Nieprawidłowy adres e-mail"),
  password: z.string().min(8, "Hasło musi mieć co najmniej 8 znaków"),
  firstName: z.string().min(2, "Imię musi mieć co najmniej 2 znaki"),
  lastName: z.string().min(2, "Nazwisko musi mieć co najmniej 2 znaki"),
  role: z.enum(["student", "reviewer", "admin", "owner"]).default("student"),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

export default function UserManager() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { t } = useTranslation();
  const { toast } = useToast();
  // Przyciski tylko dla ról, którym serwer pozwala: konta tworzy właściciel,
  // subskrypcje nadaje właściciel/support, status zmienia właściciel/admin
  const { hasRole, canManageUsers, isAdmin } = useAuth();
  const canCreateUsers = hasRole("owner");
  const canGrant = canManageUsers;
  const canChangeStatus = isAdmin;

  const createUserForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      role: "student",
    },
  });

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
    onSuccess: (_, variables) => {
      toast({
        title: variables.status === "suspended" ? "Konto zawieszone" : "Konto przywrócone",
        description:
          variables.status === "suspended"
            ? "Ta osoba nie zaloguje się, dopóki nie przywrócisz konta."
            : "Ta osoba może znów się logować.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats/users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Nie udało się zmienić statusu",
        description: describeUserError(error, "status"),
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
        title: "Nie udało się zmienić roli",
        description: describeUserError(error, "role"),
        variant: "destructive",
      });
    },
  });

  // Manage subscription mutation
  const manageSubscriptionMutation = useMutation({
    mutationFn: async ({ userId, action, durationMonths }: { userId: string; action: "grant" | "revoke"; durationMonths?: number }) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/subscription`, { action, durationMonths });
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Sukces",
        description: variables.action === "grant" ? "Subskrypcja została nadana" : "Subskrypcja została anulowana",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats/users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Nie udało się zmienić subskrypcji",
        description: describeUserError(error, "subscription"),
        variant: "destructive",
      });
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: CreateUserForm) => {
      const response = await apiRequest("POST", "/api/admin/users", userData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Użytkownik został utworzony pomyślnie",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats/users"] });
      setShowCreateDialog(false);
      createUserForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Nie udało się utworzyć konta",
        description: describeUserError(error, "create"),
        variant: "destructive",
      });
    },
  });

  const onCreateSubmit = (data: CreateUserForm) => {
    createUserMutation.mutate(data);
  };

  const getRoleBadge = (role: string) => {
    const colors = {
      student: "bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary",
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

  const getStatusBadge = (emailVerified: boolean, suspendedAt?: unknown, subscription?: any) => {
    if (suspendedAt) {
      return (
        <Badge
          variant="outline"
          className="border-[var(--alarm)] text-[var(--alarm)]"
          title={`Zawieszone ${formatDate(suspendedAt) ?? ""}`.trim()}
          data-testid="status-suspended"
        >
          <Ban className="h-3 w-3 mr-1" aria-hidden="true" />
          Zawieszone
        </Badge>
      );
    }
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
        {canCreateUsers && (
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button data-testid="add-user-button">
              <UserPlus className="h-4 w-4 mr-2" />
              Dodaj użytkownika
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Utwórz nowego użytkownika</DialogTitle>
            </DialogHeader>
            <Form {...createUserForm}>
              <form onSubmit={createUserForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createUserForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Imię</FormLabel>
                        <FormControl>
                          <Input placeholder="Jan" {...field} data-testid="create-user-firstName" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createUserForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nazwisko</FormLabel>
                        <FormControl>
                          <Input placeholder="Kowalski" {...field} data-testid="create-user-lastName" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={createUserForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@example.com" {...field} data-testid="create-user-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createUserForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hasło</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} data-testid="create-user-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createUserForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rola</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="create-user-role">
                            <SelectValue placeholder="Wybierz rolę" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="student">Student</SelectItem>
                          <SelectItem value="reviewer">Recenzent</SelectItem>
                          <SelectItem value="admin">Administrator</SelectItem>
                          <SelectItem value="owner">Właściciel</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Anuluj
                  </Button>
                  <Button type="submit" disabled={createUserMutation.isPending} data-testid="create-user-submit">
                    {createUserMutation.isPending ? "Tworzenie..." : "Utwórz użytkownika"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        )}
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
                  <SelectItem value="active">Aktywne (niezawieszone)</SelectItem>
                  <SelectItem value="suspended">Zawieszone</SelectItem>
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
                      {getStatusBadge(user.emailVerified, user.suspendedAt)}
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
                          <>
                            {canGrant && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => manageSubscriptionMutation.mutate({ 
                                userId: user.id, 
                                action: "grant",
                                durationMonths: 1
                              })}
                              disabled={manageSubscriptionMutation.isPending}
                              title="Nadaj subskrypcję (1 miesiąc)"
                              aria-label="Nadaj subskrypcję na 1 miesiąc"
                              data-testid={`grant-subscription-${user.id}`}
                            >
                              <CreditCard className="h-4 w-4" />
                            </Button>
                            )}
                            {canChangeStatus && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => updateUserStatusMutation.mutate({ 
                                userId: user.id, 
                                status: user.suspendedAt ? "active" : "suspended" 
                              })}
                              disabled={updateUserStatusMutation.isPending}
                              title={user.suspendedAt ? "Przywróć konto" : "Zawieś konto"}
                              aria-label={user.suspendedAt ? "Przywróć konto" : "Zawieś konto"}
                              data-testid={`toggle-user-${user.id}`}
                            >
                              {user.suspendedAt ? <CheckCircle className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                            </Button>
                            )}
                          </>
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
                  <label className="text-sm font-medium">Status</label>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {getStatusBadge(selectedUser.emailVerified, selectedUser.suspendedAt)}
                    {selectedUser.suspendedAt && (
                      <span className="text-sm text-muted-foreground">od {formatDate(selectedUser.suspendedAt)}</span>
                    )}
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