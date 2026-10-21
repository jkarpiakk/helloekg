import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Shield, Users, BarChart3, Settings, BookOpen, MessageCircle, FileText, HelpCircle, Home, Sparkles, Inbox } from "lucide-react";
import QuestionManager from "./QuestionManager";
import CourseManager from "./CourseManager";
import UserManager from "./UserManager";
import SupportManager from "./SupportManager";
import LearningAnalytics from "./LearningAnalytics";
import BlogManager from "./BlogManager";
import DemoQuestionManager from "./DemoQuestionManager";
import HomePageContentManager from "./HomePageContentManager";
import FutureFeatures from "./FutureFeatures";
import FeedbackAdminPanel from "./FeedbackAdminPanel";

const ADMIN_TABS = ["course", "questions", "blog", "demo", "homepage", "users", "zgloszenia", "support", "analytics", "future"];

/** ?tab=zgloszenia (np. z maila o nowym zgłoszeniu) otwiera od razu tę zakładkę */
function initialTab(): string {
  try {
    const t = new URLSearchParams(window.location.search).get("tab");
    return t && ADMIN_TABS.includes(t) ? t : "course";
  } catch {
    return "course";
  }
}

export default function AdminPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue={initialTab()} className="space-y-8">
          <TabsList className="grid w-full grid-cols-10">
            <TabsTrigger value="course" className="flex items-center space-x-2">
              <BookOpen className="h-4 w-4" />
              <span>Kurs</span>
            </TabsTrigger>
            <TabsTrigger value="questions" className="flex items-center space-x-2">
              <Shield className="h-4 w-4" />
              <span>Pytania</span>
            </TabsTrigger>
            <TabsTrigger value="blog" className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>Blog</span>
            </TabsTrigger>
            <TabsTrigger value="demo" className="flex items-center space-x-2">
              <HelpCircle className="h-4 w-4" />
              <span>Pytanie Demo</span>
            </TabsTrigger>
            <TabsTrigger value="homepage" className="flex items-center space-x-2">
              <Home className="h-4 w-4" />
              <span>Strona Główna</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Użytkownicy</span>
            </TabsTrigger>
            <TabsTrigger value="zgloszenia" className="flex items-center space-x-2" data-testid="admin-tab-feedback">
              <Inbox className="h-4 w-4" />
              <span>Zgłoszenia</span>
            </TabsTrigger>
            <TabsTrigger value="support" className="flex items-center space-x-2">
              <MessageCircle className="h-4 w-4" />
              <span>Wiadomości</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Statystyki</span>
            </TabsTrigger>
            <TabsTrigger value="future" className="flex items-center space-x-2">
              <Sparkles className="h-4 w-4" />
              <span>Future</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="course">
            <CourseManager />
          </TabsContent>

          <TabsContent value="questions">
            <QuestionManager />
          </TabsContent>

          <TabsContent value="blog">
            <BlogManager />
          </TabsContent>

          <TabsContent value="demo">
            <DemoQuestionManager />
          </TabsContent>

          <TabsContent value="homepage">
            <HomePageContentManager />
          </TabsContent>

          <TabsContent value="users">
            <UserManager />
          </TabsContent>

          <TabsContent value="zgloszenia">
            <FeedbackAdminPanel />
          </TabsContent>

          <TabsContent value="support">
            <SupportManager />
          </TabsContent>

          <TabsContent value="analytics">
            <LearningAnalytics />
          </TabsContent>

          <TabsContent value="future">
            <FutureFeatures />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
