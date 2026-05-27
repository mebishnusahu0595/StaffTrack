import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchForms, fetchFormDetails, submitFormResponse } from "../api";

export function useForms() {
  const queryClient = useQueryClient();

  const formsQuery = useQuery({
    queryKey: ["forms"],
    queryFn: fetchForms
  });

  const submitMutation = useMutation({
    mutationFn: ({ formId, data }: { formId: string; data: any }) => 
      submitFormResponse(formId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms"] });
    }
  });

  return {
    forms: formsQuery.data ?? [],
    isFetching: formsQuery.isLoading,
    refetch: formsQuery.refetch,
    submitResponse: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending
  };
}

export function useFormDetails(formId: string) {
  return useQuery({
    queryKey: ["forms", formId],
    queryFn: () => fetchFormDetails(formId),
    enabled: !!formId
  });
}
