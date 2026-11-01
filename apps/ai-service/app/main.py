from typing import Literal, TypedDict

from fastapi import FastAPI
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

app = FastAPI(title="MonsoonMesh AI service", version="0.1.0")


class AnalysisRequest(BaseModel):
    incident_id: str = Field(min_length=1)
    title: str = Field(min_length=4, max_length=160)
    description: str = Field(min_length=8, max_length=5000)
    category: str


class AnalysisResponse(BaseModel):
    incident_summary: str
    category: str
    severity_indicators: list[str]
    suggested_actions: list[str]
    uncertainty: str
    approval_required: Literal[True] = True
    provider: Literal["local-rule-based"] = "local-rule-based"


class AnalysisState(TypedDict):
    incident: dict[str, str]
    response: dict[str, object]


def build_analysis(state: AnalysisState) -> dict[str, object]:
    incident = state["incident"]
    text = f"{incident['title']} {incident['description']}".lower()
    indicators: list[str] = []
    if any(word in text for word in ("deep", "rapid", "trapped", "surging")):
        indicators.append("Description contains a potential urgent-condition keyword.")
    if "water" in text or "flood" in text:
        indicators.append("Description mentions water or flooding.")
    response = AnalysisResponse(
        incident_summary=f"{incident['category'].replace('_', ' ').title()} report: {incident['title']}",
        category=incident["category"],
        severity_indicators=indicators or ["No deterministic severity indicator identified."],
        suggested_actions=[
            "Ask an authorized operator to verify the report and location.",
            "Follow local emergency procedures and use field observations before action.",
        ],
        uncertainty=(
            "Rule-based local fallback; not a verified fact or emergency dispatch. "
            "A photograph or text report alone cannot establish road safety."
        ),
    )
    return {"response": response.model_dump()}


workflow_builder = StateGraph(AnalysisState)
workflow_builder.add_node("build_local_analysis", build_analysis)
workflow_builder.add_edge(START, "build_local_analysis")
workflow_builder.add_edge("build_local_analysis", END)
analysis_workflow = workflow_builder.compile()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "provider": "local-rule-based"}


@app.post("/analyze", response_model=AnalysisResponse)
def analyze(request: AnalysisRequest) -> AnalysisResponse:
    result = analysis_workflow.invoke({"incident": request.model_dump()})
    return AnalysisResponse.model_validate(result["response"])
