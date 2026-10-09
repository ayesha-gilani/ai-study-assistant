import {useState} from "react";
import {renderToString} from "katex";
import "katex/dist/katex.min.css";

function formatAnswer(text) {
  // Gemini sometimes escapes Markdown punctuation even when plain Markdown is requested.
  const normalized = text
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, formula) => `$$${formula.replace(/\s+/g, " ")}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, formula) => `$${formula}$`)
    .replace(/\\\*\s+/g, "\n* ")
    .replace(/\\([#_.\-])/g, "$1")
    .replace(/\\\*/g, "*")
    .replace(/\\\$/g, "$");
  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);

  const formatInline = (textLine, keyPrefix) =>
    textLine.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).map((part, index) => {
      if (part.startsWith("$$") && part.endsWith("$$")) {
        return <span key={`${keyPrefix}-${index}`} className="math-display" dangerouslySetInnerHTML={{__html: renderToString(part.slice(2, -2), {displayMode: true, throwOnError: false})}} />;
      }
      if (part.startsWith("$") && part.endsWith("$")) {
        return <span key={`${keyPrefix}-${index}`} dangerouslySetInnerHTML={{__html: renderToString(part.slice(1, -1), {throwOnError: false})}} />;
      }
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={`${keyPrefix}-${index}`}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={`${keyPrefix}-${index}`}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={`${keyPrefix}-${index}`}>{part.slice(1, -1)}</code>;
      }
      return part;
    });

  const blocks = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    const orderedItem = line.match(/^\d+\.\s+(.+)$/);
    const bulletItem = line.match(/^(?:[*-]|•)\s+(.+)$/);

    if (/^(?:---+|\*\*\*+|___+)$/.test(line)) {
      blocks.push(<hr key={`hr-${index}`} />);
      index++;
    } else if (line.startsWith("$$") && line.endsWith("$$")) {
      blocks.push(
        <div
          key={`math-${index}`}
          className="math-display"
          dangerouslySetInnerHTML={{__html: renderToString(line.slice(2, -2), {displayMode: true, throwOnError: false})}}
        />
      );
      index++;
    } else if (heading) {
      const Heading = `h${heading[1].length}`;
      blocks.push(<Heading key={`heading-${index}`}>{formatInline(heading[2], index)}</Heading>);
      index++;
    } else if (orderedItem) {
      const items = [];
      while (index < lines.length) {
        const item = lines[index].match(/^\d+\.\s+(.+)$/);
        if (!item) break;
        items.push(<li key={`ordered-${index}`}>{formatInline(item[1], index)}</li>);
        index++;
      }
      blocks.push(<ol key={`ol-${index}`}>{items}</ol>);
    } else if (bulletItem) {
      const items = [];
      while (index < lines.length) {
        const item = lines[index].match(/^(?:[*-]|•)\s+(.+)$/);
        if (!item) break;
        items.push(<li key={`bullet-${index}`}>{formatInline(item[1], index)}</li>);
        index++;
      }
      blocks.push(<ul key={`ul-${index}`}>{items}</ul>);
    } else {
      blocks.push(<p key={`paragraph-${index}`}>{formatInline(line, index)}</p>);
      index++;
    }
  }
  return blocks;
}

function App(){
  const [question, setQuestion] = useState("");
  const[answer, setAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [mode, setMode] = useState("simple");
  const[quiz, setQuiz] = useState([]);
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState("");
  const[selectedAnswers, setSelectedAnswers] = useState({});
  const[score,setScore]= useState(0);
  const[submitted, setSubmitted] =useState(false);

  const handleAsk = async () =>{
    if(!question.trim()) return;

    setIsLoading(true);
    setErrorMessage("");
    setAnswer("");
    try{
      const response = await fetch("http://127.0.0.1:5000/ask",{
        method: "POST",
        headers: {
          "Content-Type" : "application/json", 
        },
        body: JSON.stringify({
          question: question,
          mode : mode,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
      }
      setAnswer(data.answer || "The backend returned an empty answer.");
    }catch(error){
      setErrorMessage(error.message || "Could not connect to the backend.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateQuiz = async () => {
    if(!question.trim()) return;

    setIsQuizLoading(true);
    setQuizError("");
    setQuiz([]);
    setSelectedAnswers({});
    setScore(0);
    setSubmitted(false);

    try {
      const response = await fetch("http://127.0.0.1:5000/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, mode }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Quiz request failed (${response.status})`);
      }
      if (!Array.isArray(data.questions) || data.questions.length === 0) {
        throw new Error("The backend returned an empty quiz.");
      }
      setQuiz(data.questions);
    } catch (error) {
      setQuizError(error.message || "Could not connect to the backend.");
      console.error(error);
    } finally {
      setIsQuizLoading(false);
    }
  };

  const selectAnswer = (questionIndex, option) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [questionIndex]: option,
    });
  };

  const submitQuiz =() => {
    let newScore=0;

    quiz.forEach((q,index)=>{
      if (selectedAnswers[index] === q.answer){
        newScore++;
      }
    });
    setScore(newScore);
    setSubmitted(true);
  };

  return (
    <div className="app">
      <h1>🎓 AI Study Assistant</h1>
      <p>Ask anything and learn with AI</p>

      <div className="modes">
        <button onClick={()=> setMode("simple")}>
          Simple
        </button>
        <button onClick={()=> setMode("detailed")}>
          Detailed
        </button>

      </div>

      <textarea
      placeholder="What do you want to learn?"
      value={question}
      onChange={(e)=>setQuestion(e.target.value)}/>

      <button onClick={handleAsk} disabled={isLoading}>
        {isLoading ? "Thinking..." : "Ask AI"}
      </button>

      {errorMessage && <p role="alert">{errorMessage}</p>}

      <button onClick={generateQuiz} disabled={isQuizLoading}>
        {isQuizLoading ? "Generating quiz..." : "Generate Quiz"}
      </button>
      {quizError && <p role="alert">{quizError}</p>}

      {answer && (
        <div className="answer">
          <h2>AI Response</h2>
          {formatAnswer(answer)}
        </div>
      )}

      {quiz.length > 0 && (
    <div className="quiz">
    <h2>📝 Quick Quiz</h2>

    {quiz.map((q, index) => (
      <div key={index} className="quiz-question">
        <h3>
          {index + 1}. {q.question}
        </h3>

        {q.options.map((option) => {
         const isSelected = selectedAnswers[index] === option;
         const isCorrect = submitted && option === q.answer;
         const isWrong = submitted && isSelected && option !== q.answer;
      
         return(
          <button 
          key={option}
          onClick={()=> selectAnswer(index, option)}
          disabled={submitted}
          className={
            isCorrect
            ? "correct"
            : isWrong
            ? "wrong"
            :isSelected
            ? "selected"
            : ""
          }>
            {option}
          </button>
         );
        } 
        )}

        {submitted && (
        <p>
           {selectedAnswers[index] === q.answer
      ? "✅ Correct!"
      : `❌ Incorrect. Correct answer: ${q.answer}`}
       </p>
      )}

      </div>
    ))}

    <button onClick={submitQuiz}>Submit Quiz</button>

    {submitted && (
      <h3>
        Your Score: {score} / {quiz.length}
      </h3>
    )}
  </div>
)}

    </div>
  );
}


export default App;
