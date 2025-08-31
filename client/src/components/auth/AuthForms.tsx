import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Heart, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import type { LoginForm, RegisterForm } from "@/types";

interface AuthFormsProps {
  mode: "login" | "register";
  onSuccess?: () => void;
}

const loginSchema = z.object({
  email: z.string().email("Nieprawidłowy adres e-mail"),
  password: z.string().min(8, "Hasło musi mieć co najmniej 8 znaków"),
});

const registerSchema = z.object({
  email: z.string().email("Nieprawidłowy adres e-mail"),
  password: z.string().min(8, "Hasło musi mieć co najmniej 8 znaków"),
  confirmPassword: z.string(),
  firstName: z.string().min(2, "Imię musi mieć co najmniej 2 znaki"),
  lastName: z.string().min(2, "Nazwisko musi mieć co najmniej 2 znaki"),
  profession: z.string().optional(),
  termsAccepted: z.boolean().refine(val => val === true, "Musisz zaakceptować regulamin"),
  privacyAccepted: z.boolean().refine(val => val === true, "Musisz zaakceptować politykę prywatności"),
  marketingConsent: z.boolean().default(false),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Hasła nie pasują do siebie",
  path: ["confirmPassword"],
});

export default function AuthForms({ mode, onSuccess }: AuthFormsProps) {
  const [showPassword, setShowPassword] = useState(false);
  const { t } = useTranslation();
  const { login, register } = useAuth();
  const { toast } = useToast();

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      profession: "",
      termsAccepted: false,
      privacyAccepted: false,
      marketingConsent: false,
    },
  });

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Zostałeś pomyślnie zalogowany",
      });
      onSuccess?.();
      window.location.href = "/dashboard";
    },
    onError: (error: any) => {
      toast({
        title: "Błąd logowania",
        description: error.message || "Nieprawidłowe dane logowania",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: register,
    onSuccess: (data) => {
      toast({
        title: "Konto utworzone",
        description: data.message,
      });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Błąd rejestracji",
        description: error.message || "Nie udało się utworzyć konta",
        variant: "destructive",
      });
    },
  });

  const onLoginSubmit = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  const onRegisterSubmit = (data: RegisterForm) => {
    registerMutation.mutate(data);
  };

  if (mode === "login") {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
              <Heart className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">{t("auth.loginTitle")}</CardTitle>
          <CardDescription className="text-center">
            Wprowadź swoje dane aby uzyskać dostęp do konta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
              <FormField
                control={loginForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("auth.email")}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="email@example.com"
                        {...field}
                        data-testid="login-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("auth.password")}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          {...field}
                          data-testid="login-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                          data-testid="toggle-password"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
                data-testid="login-submit"
              >
                {loginMutation.isPending ? "Logowanie..." : t("auth.loginButton")}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center mb-4">
          <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
            <Heart className="h-6 w-6 text-primary-foreground" />
          </div>
        </div>
        <CardTitle className="text-2xl text-center">{t("auth.registerTitle")}</CardTitle>
        <CardDescription className="text-center">
          Utwórz konto aby rozpocząć naukę EKG
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...registerForm}>
          <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={registerForm.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("auth.firstName")}</FormLabel>
                    <FormControl>
                      <Input placeholder="Jan" {...field} data-testid="register-firstName" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={registerForm.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("auth.lastName")}</FormLabel>
                    <FormControl>
                      <Input placeholder="Kowalski" {...field} data-testid="register-lastName" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={registerForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.email")}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      {...field}
                      data-testid="register-email"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={registerForm.control}
              name="profession"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.profession")} (opcjonalnie)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Student medycyny"
                      {...field}
                      data-testid="register-profession"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={registerForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.password")}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        {...field}
                        data-testid="register-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        data-testid="toggle-password"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={registerForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.confirmPassword")}</FormLabel>
                  <FormControl>
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      {...field}
                      data-testid="register-confirmPassword"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="space-y-3">
              <FormField
                control={registerForm.control}
                name="termsAccepted"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="register-terms"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm">
                        {t("auth.termsAccepted")}
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={registerForm.control}
                name="privacyAccepted"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="register-privacy"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm">
                        {t("auth.privacyAccepted")}
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={registerForm.control}
                name="marketingConsent"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="register-marketing"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm">
                        {t("auth.marketingConsent")}
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={registerMutation.isPending}
              data-testid="register-submit"
            >
              {registerMutation.isPending ? "Tworzenie konta..." : t("auth.registerButton")}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
