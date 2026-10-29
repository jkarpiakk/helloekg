import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary] Uncaught render error:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-medium text-foreground">
                Coś poszło nie tak
              </h1>
              <p className="text-muted-foreground">
                Wystąpił nieoczekiwany błąd. Możesz spróbować ponownie lub odświeżyć stronę.
              </p>
              {process.env.NODE_ENV === "development" && this.state.error && (
                <pre className="mt-4 p-3 bg-muted rounded-lg text-left text-xs text-muted-foreground overflow-auto max-h-40">
                  {this.state.error.toString()}
                </pre>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              <Button onClick={this.handleReset} variant="default">
                Spróbuj ponownie
              </Button>
              <Button
                variant="outline"
                onClick={() => { window.location.href = "/"; }}
              >
                Wróć do strony głównej
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
