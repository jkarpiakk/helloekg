import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { MessageCircle, Clock, CheckCircle, X, Send, Search, AlertTriangle } from "lucide-react";
import type { SupportTicket } from "@shared/schema";

interface TicketStats {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  avgResponseTime: number;
}

export default function SupportManager() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [showTicketDetails, setShowTicketDetails] = useState(false);
  const [responseMessage, setResponseMessage] = useState("");
  const { t } = useTranslation();
  const { toast } = useToast();

  // Fetch support tickets with filters
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["/api/admin/support/tickets", statusFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (searchQuery) params.set("search", searchQuery);
      
      const response = await apiRequest("GET", `/api/admin/support/tickets?${params}`);
      return response.json() as Promise<SupportTicket[]>;
    },
  });

  // Fetch support statistics
  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats/support"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/stats/support");
      return response.json() as Promise<TicketStats>;
    },
  });

  // Update ticket status mutation
  const updateTicketMutation = useMutation({
    mutationFn: async ({ ticketId, status, response }: { ticketId: string; status: string; response?: string }) => {
      const data: any = { status };
      if (response) data.adminResponse = response;
      
      const apiResponse = await apiRequest("PUT", `/api/admin/support/tickets/${ticketId}`, data);
      return apiResponse.json();
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Status zgłoszenia został zaktualizowany",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats/support"] });
      setShowTicketDetails(false);
      setResponseMessage("");
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zaktualizować zgłoszenia",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const colors = {
      open: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      closed: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    };

    const labels = {
      open: "Otwarte",
      in_progress: "W trakcie",
      resolved: "Rozwiązane",
      closed: "Zamknięte",
    };

    return (
      <Badge className={colors[status as keyof typeof colors] || colors.open}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };

    const labels = {
      low: "Niski",
      medium: "Średni", 
      high: "Wysoki",
    };

    return (
      <Badge className={colors[priority as keyof typeof colors] || colors.medium}>
        {labels[priority as keyof typeof labels] || priority}
      </Badge>
    );
  };

  const handleSendResponse = () => {
    if (!selectedTicket || !responseMessage.trim()) return;
    
    updateTicketMutation.mutate({
      ticketId: selectedTicket.id,
      status: "resolved",
      response: responseMessage,
    });
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
          <h2 className="text-2xl font-bold">Wiadomości i zgłoszenia</h2>
          <p className="text-muted-foreground">
            Odpowiadaj na zgłoszenia użytkowników i zarządzaj komunikacją
          </p>
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Wszystkie zgłoszenia</CardTitle>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTickets}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Otwarte</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.openTickets}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rozwiązane</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.resolvedTickets}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Śr. czas odpowiedzi</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgResponseTime}h</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Wyszukaj zgłoszenia
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Temat, treść lub email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="search-tickets"
                />
              </div>
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
                  <SelectItem value="open">Otwarte</SelectItem>
                  <SelectItem value="in_progress">W trakcie</SelectItem>
                  <SelectItem value="resolved">Rozwiązane</SelectItem>
                  <SelectItem value="closed">Zamknięte</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tickets table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="tickets-table">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-4 font-semibold text-foreground">Zgłoszenie</th>
                  <th className="text-left p-4 font-semibold text-foreground">Użytkownik</th>
                  <th className="text-left p-4 font-semibold text-foreground">Status</th>
                  <th className="text-left p-4 font-semibold text-foreground">Priorytet</th>
                  <th className="text-left p-4 font-semibold text-foreground">Data utworzenia</th>
                  <th className="text-left p-4 font-semibold text-foreground">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tickets?.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-secondary/50" data-testid={`ticket-row-${ticket.id}`}>
                    <td className="p-4">
                      <div>
                        <h4 className="font-medium text-foreground">{ticket.subject}</h4>
                        <p className="text-sm text-muted-foreground">
                          {ticket.message.substring(0, 100)}...
                        </p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="text-sm font-medium">{ticket.userEmail}</p>
                        <p className="text-xs text-muted-foreground">{ticket.userName}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      {getStatusBadge(ticket.status)}
                    </td>
                    <td className="p-4">
                      {getPriorityBadge(ticket.priority || "medium")}
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(ticket.createdAt).toLocaleDateString('pl-PL')}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => {
                            setSelectedTicket(ticket);
                            setShowTicketDetails(true);
                          }}
                          data-testid={`view-ticket-${ticket.id}`}
                        >
                          Odpowiedz
                        </Button>
                        {ticket.status === "open" && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => updateTicketMutation.mutate({ 
                              ticketId: ticket.id, 
                              status: "in_progress" 
                            })}
                            disabled={updateTicketMutation.isPending}
                            data-testid={`progress-ticket-${ticket.id}`}
                          >
                            W trakcie
                          </Button>
                        )}
                        {ticket.status !== "closed" && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => updateTicketMutation.mutate({ 
                              ticketId: ticket.id, 
                              status: "closed" 
                            })}
                            disabled={updateTicketMutation.isPending}
                            data-testid={`close-ticket-${ticket.id}`}
                          >
                            <X className="h-4 w-4" />
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

      {tickets?.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Brak zgłoszeń</h3>
            <p className="text-muted-foreground">
              Nie ma zgłoszeń spełniających kryteria wyszukiwania
            </p>
          </CardContent>
        </Card>
      )}

      {/* Ticket Details Dialog */}
      <Dialog open={showTicketDetails} onOpenChange={setShowTicketDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Odpowiedź na zgłoszenie</DialogTitle>
          </DialogHeader>
          
          {selectedTicket && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">{selectedTicket.subject}</h4>
                  <div className="flex items-center space-x-2 mt-2">
                    {getStatusBadge(selectedTicket.status)}
                    {getPriorityBadge(selectedTicket.priority || "medium")}
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Od:</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedTicket.userName} ({selectedTicket.userEmail})
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Wiadomość:</label>
                  <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm">{selectedTicket.message}</p>
                  </div>
                </div>
                
                {selectedTicket.adminResponse && (
                  <div>
                    <label className="text-sm font-medium">Poprzednia odpowiedź:</label>
                    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-sm">{selectedTicket.adminResponse}</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <label className="text-sm font-medium">Twoja odpowiedź:</label>
                <Textarea
                  value={responseMessage}
                  onChange={(e) => setResponseMessage(e.target.value)}
                  placeholder="Napisz odpowiedź dla użytkownika..."
                  className="mt-2"
                  rows={4}
                  data-testid="response-textarea"
                />
              </div>
              
              <div className="flex space-x-2">
                <Button
                  onClick={() => setShowTicketDetails(false)}
                  variant="outline"
                >
                  Anuluj
                </Button>
                <Button
                  onClick={handleSendResponse}
                  disabled={!responseMessage.trim() || updateTicketMutation.isPending}
                  data-testid="send-response"
                >
                  {updateTicketMutation.isPending ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Wyślij odpowiedź
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}