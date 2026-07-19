import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import Logo from "@/components/layout/Logo";

const resetPasswordFormSchema = z.object({
  password: z.string().min(8, "Hasło musi mieć co najmniej 8 znaków"),
  confirmPassword: z.string().min(8, "Hasło musi mieć co najmniej 8 znaków"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Hasła nie pasują do siebie",
  path: ["confirmPassword"],
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;

export default function ResetPassword() {
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const token = params.get("token");

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const resetMutation = useMutation({
    mutationFn: async (data: ResetPasswordFormValues) => {
      const res = await apiRequest("POST", "/api/auth/reset-password", {
        token,
        password: data.password,
        confirmPassword: data.confirmPassword,
      });
      return res.json();
    },
    onSuccess: () => {
      setSuccess(true);
    },
    onError: (error: any) => {
      let description = "Nie udało się zmienić hasła";
      try {
        const jsonStart = error.message?.indexOf("{");
        if (jsonStart >= 0) {
          const parsed = JSON.parse(error.message.substring(jsonStart));
          description = parsed.error || description;
        }
      } catch {}
      toast({
        title: "Błąd",
        description,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ResetPasswordFormValues) => {
    resetMutation.mutate(data);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <h2 className="text-xl font-semibold">Nieprawidłowy link</h2>
              <p className="text-muted-foreground">
                Link do resetowania hasła jest nieprawidłowy lub niekompletny. Spróbuj ponownie poprosić o reset hasła.
              </p>
              <Button asChild>
                <a href="/">Wróć na stronę główną</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <h2 className="text-xl font-semibold">Hasło zmienione!</h2>
              <p className="text-muted-foreground">
                Twoje hasło zostało pomyślnie zmienione. Możesz się teraz zalogować używając nowego hasła.
              </p>
              <Button asChild>
                <a href="/">Zaloguj się</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Logo markSize={56} />
          </div>
          <CardTitle className="text-2xl text-center">Ustaw nowe hasło</CardTitle>
          <CardDescription className="text-center">
            Wprowadź nowe hasło dla swojego konta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nowe hasło</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
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
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Potwierdź hasło</FormLabel>
                    <FormControl>
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={resetMutation.isPending}
              >
                {resetMutation.isPending ? "Zmieniam hasło..." : "Zmień hasło"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
