from app.core.exceptions import BusinessRuleError
from app.db.models.archive_agent import ArchiveAgentTurn
from app.repositories.archive_agent import ArchiveAgentRepository
from app.schemas.archive_agent import AgentEvidence, AgentTurnOut
from app.services.archive_cards_service import case_cards
from app.services.chat_service import course_context, generate_reply


class ArchiveChatCompatibilityService:
    def __init__(self, session):
        self.repository = ArchiveAgentRepository(session)

    async def history(self, user_id: int, case: dict, unlocked: bool) -> list[AgentTurnOut]:
        turns = await self.repository.recent_turns(user_id, case["code"])
        knowledge = await self.repository.knowledge(case["theory_codes"]) if unlocked else []
        return [self._turn_out(turn, case, knowledge) for turn in turns]

    def _turn_out(self, turn, case, knowledge) -> AgentTurnOut:
        cards = {card["id"]: card for card in case_cards(case)}
        points = {point.code: point for point in knowledge}
        evidence = []
        for item_id in turn.evidence_ids:
            if item_id in cards:
                card = cards[item_id]
                evidence.append(AgentEvidence(
                    id=item_id, label=card["label"], text=card["text"], source=card["source"], kind="archive",
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

    async def investigate(self, user_id, case, progress, request, llm) -> AgentTurnOut:
        cards = {card["id"]: card for card in case_cards(case)}
        if request.focus_clue_id and request.focus_clue_id not in cards:
            raise BusinessRuleError("请选择本关的档案卡")
        question = request.question.strip() or "请解释本关主题，并给我一条学习建议。"
        previous = await self.repository.recent_turns(user_id, case["code"])
        history = [message for turn in previous for message in [
            {"role": "user", "content": turn.question}, {"role": "assistant", "content": turn.answer},
        ]]
        context = course_context(question, case, progress.clues_solved)
        if request.focus_clue_id:
            context += "\n用户指定的档案卡：" + cards[request.focus_clue_id]["label"]
        answer = await generate_reply(llm, question, history, context)
        stage = "reflect" if progress.completed_at else "connect" if progress.clues_solved else "explore"
        turn = await self.repository.save(ArchiveAgentTurn(
            user_id=user_id, case_code=case["code"], question=question, answer=answer, stage=stage,
            focus_clue_id=request.focus_clue_id,
            evidence_ids=[request.focus_clue_id] if request.focus_clue_id else [],
            tools=["连续对话", "查阅课程材料"], mode="online",
        ))
        return self._turn_out(turn, case, [])
