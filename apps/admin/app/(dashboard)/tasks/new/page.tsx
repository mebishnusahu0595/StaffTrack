"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ClickableLocationMap } from "@/components/admin/google-map";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createTask, fetchUsers } from "@/lib/api";

export default function AssignTaskPage() {
  const router = useRouter();
  const usersQuery = useQuery({ queryKey: ["users", "assign-task"], queryFn: () => fetchUsers({ page: 1, pageSize: 100 }) });
  const employees = useMemo(() => {
    return (usersQuery.data?.items ?? []).filter(
      (user) => user.role !== "ADMIN" && user.role !== "SUPERADMIN"
    );
  }, [usersQuery.data?.items]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | undefined>();

  const mutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      router.push("/tasks");
      router.refresh();
    }
  });

  const selectedLocationLabel = useMemo(
    () => (location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : "No coordinates selected"),
    [location]
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Assign Task" description="Create a new field task and optionally pin a location target." />

      <Card>
        <CardContent className="grid gap-6 p-6 xl:grid-cols-[1.1fr_1fr]">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Assign To</Label>
              <Select value={assignedToId} onValueChange={setAssignedToId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </div>
            <div className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-600">
              Selected location: <span className="font-medium text-slate-900">{selectedLocationLabel}</span>
            </div>
            <Button
              onClick={() =>
                mutation.mutate({
                  title,
                  description,
                  assignedToId,
                  dueDate,
                  lat: location?.lat,
                  lng: location?.lng
                })
              }
              disabled={mutation.isPending || !title || !description || !assignedToId || !dueDate}
            >
              Create task
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Location</Label>
            <ClickableLocationMap selected={location} onSelect={setLocation} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
