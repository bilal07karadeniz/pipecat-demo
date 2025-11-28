from typing import List, Optional
from app.models.session import Asset


def build_system_prompt(
    user_prompt: str,
    assets: List[Asset],
    kb_terms: Optional[List[str]] = None,
) -> str:
    """Build the complete system prompt for the interview bot."""

    base_prompt = f"""You are Maya, an AI interviewer conducting a voice intake call.

## Your Instructions
{user_prompt}

## Conversation Guidelines
- Ask ONE question at a time
- Wait for the user's response before moving on
- Confirm understanding before proceeding to the next topic
- Keep responses concise and natural for voice conversation
- If the user seems confused, offer clarification
- Be friendly but professional

## Available Actions
You can use function calls to interact with the system. The functions are provided through the API - do NOT output function syntax in your text response. Simply decide when to call a function and the system will handle it.

Available functions:
- show_asset: Display an image or slide to the user
- hide_asset: Hide the currently displayed asset
"""

    if kb_terms:
        base_prompt += f"""- kb_lookup: Look up a term in the knowledge base

Available terms in the knowledge base: {', '.join(kb_terms)}

When a user asks about terminology, call kb_lookup with the term, then explain the result naturally.
"""

    if assets:
        base_prompt += "\n## Available Assets (use with show_asset)\n"
        for asset in assets:
            if asset.type == "video":
                duration = f", {asset.duration_sec}s" if asset.duration_sec else ""
                base_prompt += f"- {asset.asset_id}: {asset.title} (video{duration})\n"
            else:
                base_prompt += f"- {asset.asset_id}: {asset.title} (image/slide)\n"

        base_prompt += """
Call show_asset with the asset_id when you want to show something visually. Call hide_asset when done.
"""

    base_prompt += """
## Response Format
- Speak naturally as if in a voice conversation
- Avoid using markdown, bullet points, or special formatting
- Keep responses brief (1-3 sentences typically)
- Start the conversation with a brief greeting and your first question
"""

    return base_prompt
