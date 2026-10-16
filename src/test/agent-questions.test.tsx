import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentAnswer, AgentQuestionStep } from "@/components/agent-question";
import { PlanningQuestions } from "@/components/planning-questions";
import { answerValid, questionSchema, questionsSchema } from "@/shared/agent-questions";

const single = questionSchema.parse({ key: "schedule", label: "What schedule fits?", type: "single", options: ["Fixed", "Flexible"], optional: false });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("Validated agent questions", () => {
  it("rejects missing choices, duplicates and invalid answers", () => {
    expect(questionsSchema.safeParse({ questions: [{ ...single, options: [] }] }).success).toBe(false);
    expect(questionSchema.safeParse({ ...single, options: ["Fixed", "Fixed"] }).success).toBe(false);
    expect(answerValid(single, "Invented")).toBe(false);
    expect(answerValid(single, "Fixed")).toBe(true);
    expect(answerValid({ ...single, type: "multi" }, ["Fixed", "Fixed"])).toBe(false);
    expect(answerValid({ ...single, type: "scale" }, Number.NaN)).toBe(false);
    expect(answerValid({ ...single, optional: true }, undefined)).toBe(true);
  });
  it("supports selecting and deselecting multiselect choices", () => {
    const change = vi.fn();
    const { rerender } = render(<AgentAnswer question={{ ...single, type: "multi" }} value={[]} onChange={change} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Fixed" }));
    expect(change).toHaveBeenLastCalledWith(["Fixed"]);
    rerender(<AgentAnswer question={{ ...single, type: "multi" }} value={["Fixed"]} onChange={change} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Fixed" }));
    expect(change).toHaveBeenLastCalledWith([]);
    expect(screen.queryByLabelText("Your own answer")).not.toBeInTheDocument();
  });
  it("renders invalid-output recovery without displaying unsafe output", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ label: "<script>bad</script>" })).mockResolvedValueOnce(Response.json(single));
    vi.stubGlobal("fetch", fetcher);
    render(<AgentQuestionStep workflow="planning" fieldKey="schedule" answers={{}} value={undefined} onChange={vi.fn()} />);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("radio", { name: "Fixed" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("restores planning drafts, navigates back and reports failed saves", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const answer = vi.fn().mockResolvedValue(undefined);
    render(<PlanningQuestions questions={[single, { ...single, key: "sleep", label: "Sleep schedule?" }]} initial={{ answers: { schedule: "Fixed" }, step: 0 }} onSave={save} onAnswer={answer} disabled={false} />);
    expect(screen.getByRole("radio", { name: "Fixed" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Sleep schedule?");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await screen.findByText("What schedule fits?");
    expect(screen.getByRole("radio", { name: "Fixed" })).toHaveAttribute("aria-checked", "true");
    save.mockRejectedValue(new Error("offline"));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Answers not saved"));
    expect(answer).not.toHaveBeenCalled();
  });
});