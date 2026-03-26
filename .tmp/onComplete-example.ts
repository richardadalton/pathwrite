import { PathEngine, PathDefinition } from "@daltonr/pathwrite-core";

// Example: Simple survey with onComplete callback
interface SurveyData {
  name: string;
  email: string;
  rating: number;
  feedback: string;
}

const surveyPath: PathDefinition<SurveyData> = {
  id: "survey",
  steps: [
    {
      id: "info",
      title: "Your Information",
      fieldMessages: ({ data }) => ({
        name: !data.name?.trim() ? "Name is required" : undefined,
        email: !data.email?.includes("@") ? "Valid email required" : undefined,
      }),
    },
    {
      id: "feedback",
      title: "Feedback",
      fieldMessages: ({ data }) => ({
        rating: !data.rating ? "Please provide a rating" : undefined,
      }),
    },
  ],
  onComplete: async (data) => {
    // Submit to API
    console.log("Submitting survey...");
    await fetch("/api/surveys", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" },
    });
    console.log("Survey submitted successfully!");
  },
  onCancel: (data) => {
    // Track cancellation
    console.log("Survey cancelled at step:", data);
  },
};

// Usage
async function runSurvey() {
  const engine = new PathEngine();
  
  await engine.start(surveyPath, {
    name: "",
    email: "",
    rating: 0,
    feedback: "",
  });

  // Simulate user filling out the form
  await engine.setData("name", "Alice");
  await engine.setData("email", "alice@example.com");
  await engine.next(); // Move to feedback step

  await engine.setData("rating", 5);
  await engine.setData("feedback", "Great product!");
  
  // Complete the survey - onComplete will be called automatically
  await engine.next();
  // Console output: "Submitting survey..." then "Survey submitted successfully!"
}

// Example with cancellation
async function cancelSurvey() {
  const engine = new PathEngine();
  
  await engine.start(surveyPath, {
    name: "Bob",
    email: "bob@example.com",
    rating: 0,
    feedback: "",
  });

  // User decides to cancel
  await engine.cancel();
  // Console output: "Survey cancelled at step: { name: 'Bob', email: 'bob@example.com', ... }"
}

export { runSurvey, cancelSurvey };

