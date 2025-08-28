import React, { useState } from "react";

function App() {
  const [skill, setSkill] = useState("");
  const [ranked, setRanked] = useState([]);
  const [skills, setSkills] = useState([]);
  const [weights, setWeights] = useState({
    skill: 70,
    experience: 20,
    internship: 5,
    certification: 5,
  });

  const updateWeights = async () => {
    const total =
      weights.skill +
      weights.experience +
      weights.internship +
      weights.certification;
    if (total !== 100) {
      alert("Weights must add up to 100");
      return;
    }
    await fetch("http://localhost:5000/set-weights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(weights),
    });
    alert("Weights updated!");
  };

  const addSkill = async () => {
    if (!skill) return;
    const res = await fetch("http://localhost:5000/filter-skill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skill }),
    });
    const data = await res.json();
    setRanked(data.ranked);
    setSkills(data.activeSkills);
    setSkill("");
  };

  const sendEmails = async () => {
    const res = await fetch("http://localhost:5000/send-emails", {
      method: "POST",
    });
    const data = await res.json();
    alert(`Emails sent to ${data.emailed.length} candidates`);
  };

  const reset = async () => {
    const res = await fetch("http://localhost:5000/reset", { method: "POST" });
    const data = await res.json();
    setSkills(data.activeSkills);
    setRanked([]);
    alert("Skills reset!");
  };

  return (
    <div>
      <h2>Interactive AI Recruitment Assistant</h2>

      <h3>⚖️ Set Weights (must total 100)</h3>
      <div>
        <label>Skill %: </label>
        <input
          type="number"
          value={weights.skill}
          onChange={(e) =>
            setWeights({ ...weights, skill: parseInt(e.target.value) })
          }
        />
        <label> Experience %: </label>
        <input
          type="number"
          value={weights.experience}
          onChange={(e) =>
            setWeights({ ...weights, experience: parseInt(e.target.value) })
          }
        />
        <label> Internship %: </label>
        <input
          type="number"
          value={weights.internship}
          onChange={(e) =>
            setWeights({ ...weights, internship: parseInt(e.target.value) })
          }
        />
        <label> Certification %: </label>
        <input
          type="number"
          value={weights.certification}
          onChange={(e) =>
            setWeights({
              ...weights,
              certification: parseInt(e.target.value),
            })
          }
        />
        <button onClick={updateWeights}>Update Weights</button>
      </div>

      <h3>🎯 Add Skill</h3>
      <input
        type="text"
        value={skill}
        onChange={(e) => setSkill(e.target.value)}
        placeholder="Enter skill (e.g. Java, SQL)"
      />
      <button onClick={addSkill}>Add Skill</button>
      <button onClick={reset}>Reset</button>

      {skills.length > 0 && (
        <p>
          Active Skills: <b>{skills.join(", ")}</b>
        </p>
      )}

      {ranked.length > 0 && (
        <>
          <h3>Ranked Candidates</h3>
          <ul>
            {ranked.map((c, i) => (
              <li key={i}>
                <b>{c.name}</b> — Score: {c.score.toFixed(2)}{" "}
                {c.email ? `(${c.email})` : "(no email)"}
              </li>
            ))}
          </ul>
          <button onClick={sendEmails}>📧 Send Emails to Top 5</button>
        </>
      )}
    </div>
  );
}

export default App;