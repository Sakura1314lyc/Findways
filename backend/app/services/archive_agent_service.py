import asyncio
import json

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError
from app.db.models.archive import ArchiveProgress
from app.db.models.archive_agent import ArchiveAgentTurn
from app.llm.client import LLMPort
from app.rag.retriever import tokenize
from app.repositories.archive_agent import ArchiveAgentRepository
from app.schemas.archive_agent import AgentEvidence, AgentRequest, AgentTurnOut
from app.services.archive_cards_service import case_cards


def relevant_index(query: str, items: list[tuple[str, str]], previous_ids: list[str]) -> int:
    words = set(tokenize(query))
    scored = [
        (len(words & set(tokenize(text))) * 3 - previous_ids.count(item_id), -index)
        for index, (item_id, text) in enumerate(items)
    ]
    if not words or max(score for score, _ in scored) <= 0:
        if previous_ids:
            last = next((index for index, (item_id, _) in enumerate(items) if item_id == previous_ids[-1]), -1)
            return (last + 1) % len(items)
        return 0
    return max(range(len(items)), key=lambda index: scored[index])


class ArchiveAgentService:
    def __init__(self, session: AsyncSession):
        self.repository = ArchiveAgentRepository(session)

    async def history(self, user_id: int, case: dict, unlocked: bool) -> list[AgentTurnOut]:
        turns = await self.repository.recent_turns(user_id, case["code"])
        knowledge = await self.repository.knowledge(case["theory_codes"]) if unlocked else []
        return [self._turn_out(turn, case, knowledge) for turn in turns]

    def _turn_out(self, turn: ArchiveAgentTurn, case: dict, knowledge: list) -> AgentTurnOut:
        clues = {clue["id"]: clue for clue in case_cards(case)}
        points = {point.code: point for point in knowledge}
        evidence = []
        for item_id in turn.evidence_ids:
            if item_id in clues:
                clue = clues[item_id]
                evidence.append(AgentEvidence(
                    id=item_id, label=clue["label"], text=clue["text"],
                    source=clue["source"], kind="archive",
                ))
            elif item_id in points:
                point = points[item_id]
                evidence.append(AgentEvidence(
                    id=item_id, label=point.name, text=point.summary,
                    source="理论手册｜" + "、".join(point.sources or [point.chapter]), kind="knowledge",
                ))
        return AgentTurnOut(
            id=turn.id, question=turn.question, answer=turn.answer, stage=turn.stage,
            focus_clue_id=turn.focus_clue_id, evidence=evidence, tools=turn.tools,
            mode=turn.mode, created_at=turn.created_at,
        )

    async def investigate(
        self, user_id: int, case: dict, progress: ArchiveProgress, request: AgentRequest, llm: LLMPort,
    ) -> AgentTurnOut:
        question = request.question.strip()
        if request.focus_clue_id and request.focus_clue_id not in {clue["id"] for clue in case_cards(case)}:
            raise BusinessRuleError("请选择本关的档案卡")
        previous = await self.repository.recent_turns(user_id, case["code"])
        turn_count = await self.repository.turn_count(user_id, case["code"])
        wrong_attempts = await self.repository.wrong_attempts(user_id, case["code"])
        stage = "reflect" if progress.completed_at else "connect" if progress.clues_solved else "explore"
        knowledge = await self.repository.knowledge(case["theory_codes"]) if progress.clues_solved else []
        cards = case_cards(case)
        previous_ids = [turn.focus_clue_id for turn in previous if turn.focus_clue_id]
        card_items = [(clue["id"], clue["label"] + " " + clue["text"]) for clue in cards]
        chosen_clue = cards[relevant_index(question, card_items, previous_ids)]
        if request.focus_clue_id:
            chosen_clue = next(clue for clue in cards if clue["id"] == request.focus_clue_id)
        chosen_point = None
        if knowledge:
            point_items = [(point.code, point.name + " " + point.summary) for point in knowledge]
            previous_evidence = [item for turn in previous for item in turn.evidence_ids]
            point_index = relevant_index(question, point_items, previous_evidence)
            chosen_point = knowledge[point_index]
        primary = "archive_card"
        style = turn_count % 3
        mode = "offline"
        if not llm.is_mock:
            allowed = [{"tool": "archive_card", "id": clue["id"], "label": clue["label"], "text": clue["text"]}
                       for clue in cards]
            if knowledge:
                allowed.extend({"tool": "knowledge_point", "id": point.code, "label": point.name}
                               for point in knowledge)
            observation = {
                "stage": stage, "wrong_attempts": wrong_attempts, "question": question,
                "focus_clue_id": request.focus_clue_id,
                "recent_questions": [turn.question for turn in previous[-3:]],
                "available_tools": allowed,
            }
            try:
                plan = await asyncio.wait_for(llm.chat_json(
                    system="你是毛概档案探究 Agent 的规划器。根据当前学习阶段和问题，在给定工具中选一项取证，"
                    "再选择下一步提问方式。只依据提供的档案，不编造史料与引文，不给出卡片正确顺序，"
                    "不代写发现笔记。只返回 JSON："
                    "{\"tool\":\"archive_card或knowledge_point\",\"id\":\"提供的id\",\"question_style\":0到2的整数}。",
                    user=json.dumps(observation, ensure_ascii=False),
                    temperature=0.2, max_tokens=120,
                ), timeout=8)
                permitted = {(item["tool"], item["id"]) for item in allowed}
                if (isinstance(plan, dict) and (plan.get("tool"), plan.get("id")) in permitted
                        and type(plan.get("question_style")) is int and 0 <= plan["question_style"] <= 2
                        and (not request.focus_clue_id or plan["tool"] != "archive_card"
                             or plan["id"] == request.focus_clue_id)):
                    primary = plan["tool"]
                    style = plan["question_style"]
                    if primary == "archive_card":
                        chosen_clue = next(clue for clue in cards if clue["id"] == plan["id"])
                    else:
                        chosen_point = next(point for point in knowledge if point.code == plan["id"])
                    mode = "online"
            except Exception:
                pass
        evidence_ids = [chosen_clue["id"]]
        tools = ["核对学习阶段", "查阅档案卡"]
        if chosen_point:
            evidence_ids.append(chosen_point.code)
            tools.append("检索理论手册")
        if primary == "knowledge_point" and chosen_point:
            evidence_ids.reverse()
        if stage == "explore":
            prompts = (
                f"先看《{chosen_clue['label']}》：它讲的是当时面临的问题、采取的行动，还是逐步形成的认识？",
                f"把《{chosen_clue['label']}》与另一张卡对照：哪条材料能帮助你判断它们的先后关系？",
                f"《{chosen_clue['label']}》列出的出处能支持你当前的判断吗？再找一张卡核对。",
            )
            if wrong_attempts:
                prompts = (
                    f"你已经核对过线索。重新看《{chosen_clue['label']}》：它在故事中更像问题的起点，还是后来的回应？",
                    *prompts[1:],
                )
        elif stage == "connect":
            name = chosen_point.name if chosen_point else case["theory_name"]
            prompts = (
                f"把《{chosen_clue['label']}》与理论手册中的“{name}”放在一起：这项实践回应了什么问题？",
                f"从《{chosen_clue['label']}》的出处出发，哪条证据能支持你对“{name}”的理解？",
                f"如果用自己的话解释“{name}”，你会先引用《{chosen_clue['label']}》中的哪条线索？",
            )
        else:
            prompts = (
                f"回看已保存的发现笔记，再对照《{chosen_clue['label']}》：哪一句判断有材料支持？",
                f"《{chosen_clue['label']}》的出处能为你笔记里的哪一个判断补上依据？",
                f"你会怎样用《{chosen_clue['label']}》核对笔记中的因果关系，而不只重复结论？",
            )
        answer = prompts[style]
        if question:
            answer = "围绕你的问题，" + answer
        turn = await self.repository.save(ArchiveAgentTurn(
            user_id=user_id, case_code=case["code"], question=question or "请给我下一条线索",
            answer=answer, stage=stage, focus_clue_id=chosen_clue["id"],
            evidence_ids=evidence_ids, tools=tools, mode=mode,
        ))
        return self._turn_out(turn, case, knowledge)
