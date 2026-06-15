import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Application configuration</p>
      </div>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>Application-wide configuration will appear here.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No configurable settings yet.</p>
        </CardContent>
      </Card>
    </div>
  );
}
