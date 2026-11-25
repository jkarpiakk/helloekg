import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { StronaBledu } from "@/components/bledy/StronaBledu";

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
        <div className="min-h-screen bg-background">
          <StronaBledu
            kod="BŁĄD"
            rodzaj="artefakt"
            etykieta="Błąd aplikacji"
            tytul="Artefakt na zapisie"
            dzialania={
              <>
                <Button onClick={this.handleReset}>Spróbuj ponownie</Button>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Odśwież stronę
                </Button>
              </>
            }
            dopisek={
              <>
                Wraca przy tym samym kroku?{" "}
                <a href="/zgloszenie" className="text-[var(--txt)] underline underline-offset-4">
                  Napisz, co robisz
                </a>
                , a znajdziemy przyczynę.
                {process.env.NODE_ENV === "development" && this.state.error && (
                  <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-[var(--panel)] p-3 text-left text-xs text-[var(--txt2)]">
                    {this.state.error.toString()}
                  </pre>
                )}
              </>
            }
          >
            <p>
              Coś zakłóciło ten widok po naszej stronie, nie po twojej. Zatwierdzone odpowiedzi i postęp są zapisane.
              Spróbuj jeszcze raz albo odśwież stronę.
            </p>
          </StronaBledu>
        </div>
      );
    }

    return this.props.children;
  }
}
