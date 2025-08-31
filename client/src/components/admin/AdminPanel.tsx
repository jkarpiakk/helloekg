import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Shield, Users, BarChart3, Settings } from "lucide-react";
import QuestionManager from "./QuestionManager";

export default function AdminPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">{t("admin.panel")}</h1>
                <p className="text-sm text-muted-foreground">{t("admin.manageContent")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Tabs defaultValue="questions" className="space-y-8">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="questions" className="flex items-center space-x-2">
              <Shield className="h-4 w-4" />
              <span>{t("admin.questions")}</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>{t("admin.users")}</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>{t("admin.analytics")}</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>{t("admin.settings")}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="questions">
            <QuestionManager />
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Zarządzanie użytkownikami</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Funkcjonalność zarządzania użytkownikami będzie dostępna wkrótce.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>Analityka</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Panel analityczny będzie dostępny wkrótce.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Ustawienia systemu</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Ustawienia systemu będą dostępne wkrótce.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
