export function ErrorScreen({ error }: { error: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-destructive">Error</h1>
        <p className="mt-4 text-lg text-muted-foreground">{error}</p>
      </div>
    </main>
  );
}

export function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
        <h1 className="text-2xl font-bold">Claude Tauri</h1>
        <p className="text-muted-foreground">Starting server...</p>
      </div>
    </main>
  );
}
