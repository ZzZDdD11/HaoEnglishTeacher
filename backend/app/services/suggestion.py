from app.schemas.evaluation import WordScoreItem

# Common English pronunciation issues for Chinese speakers
ISSUE_TEMPLATES = {
    "th": "注意咬舌音 /θ/ 或 /ð/：舌尖轻触上齿，气流从舌齿间通过",
    "r": "注意卷舌音 /r/：舌尖卷起靠近上颚但不要碰到",
    "l": "注意 /l/ 音：舌尖抵住上齿龈，声带振动",
    "v": "注意 /v/ 音：上齿轻咬下唇，声带振动（不要发成 /w/）",
    "w": "注意 /w/ 音：双唇收圆但不咬唇（不要发成 /v/）",
    "n": "注意区分 /n/ 和 /l/：/n/ 是鼻音，气流从鼻腔通过",
    "long_vowel": "注意长元音要拉长：/iː/ /uː/ /ɑː/ 等要读够时长",
    "short_vowel": "注意短元音要短促有力：/ɪ/ /ʊ/ /ʌ/ 不要拖长",
    "final_consonant": "注意词尾辅音不要漏掉，每个音节都要完整发出",
    "stress": "注意单词重音位置，重读音节要更用力、更长、更清楚",
    "link": "注意连读，前一个词的尾辅音和后一个词的首元音要连在一起",
}


def generate_suggestions(word_scores: list[WordScoreItem]) -> list[str]:
    """Generate Chinese-language pronunciation tips based on low-scoring words."""
    low_words = [w for w in word_scores if w.score < 70]
    suggestions = []
    seen_templates = set()

    for w in low_words:
        word_lower = w.word.lower()
        template_key = _match_template(word_lower)
        if template_key and template_key not in seen_templates:
            seen_templates.add(template_key)
            suggestions.append(ISSUE_TEMPLATES[template_key])

    if not suggestions and low_words:
        suggestions.append("尝试放慢速度，将每个音节读清楚")

    # Add general advice for overall low score
    if len(low_words) >= 3:
        suggestions.insert(0, f"有 {len(low_words)} 个单词分数偏低，建议重点重练这些词：{'、'.join(w.word for w in low_words[:5])}")

    return suggestions


def _match_template(word: str) -> str | None:
    """Match a word to a pronunciation issue template."""
    if "th" in word:
        return "th"
    if word.startswith("r"):
        return "r"
    if "l" in word and not word.startswith("l") and word.endswith("l"):
        return "l"
    if "v" in word:
        return "v"
    if word.startswith("w"):
        return "w"

    # Count vowels for length hints
    import re
    vowels = re.findall(r"[aeiou]+", word)
    for v in vowels:
        if len(v) >= 2:
            return "long_vowel"

    if word.endswith(("t", "d", "k", "g", "p", "b", "s", "z")):
        return "final_consonant"

    return None
