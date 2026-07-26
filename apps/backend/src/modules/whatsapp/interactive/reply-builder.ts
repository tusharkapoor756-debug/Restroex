import { InteractiveScreen } from './interactive-action.types';

export class ReplyBuilder {
  /**
   * Translates a rich InteractiveScreen object into a user-friendly WhatsApp text body
   * with numbered options for client platforms that don't support native buttons (like whatsapp-web.js),
   * and saves the mapping of choices to the session context.
   */
  public static buildTextFallback(
    screen: InteractiveScreen
  ): { text: string; optionsMap: Array<{ key: string; payload: any }> } {
    let body = '';

    // Header Title Card
    if (screen.title) {
      body += `🍽️ *${screen.title}*\n`;
      body += `━━━━━━━━━━━━━━\n\n`;
    }

    body += screen.body;
    body += '\n\n';

    const optionsMap: Array<{ key: string; payload: any }> = [];
    let optionCounter = 1;

    // Add buttons as numbered card options
    if (screen.buttons && screen.buttons.length > 0) {
      for (const btn of screen.buttons) {
        try {
          const payloadObj = JSON.parse(btn.id);
          if (btn.title !== 'context_holder') {
            body += `【${optionCounter}】 *${btn.title}*\n`;
            optionsMap.push({
              key: optionCounter.toString(),
              payload: payloadObj,
            });
            optionsMap.push({
              key: btn.title.toLowerCase().trim(),
              payload: payloadObj,
            });
            optionCounter++;
          } else {
            optionsMap.push({
              key: 'context_holder',
              payload: payloadObj,
            });
          }
        } catch (e) {
          // Fallback if not valid JSON
        }
      }
    }

    // Add list items as numbered card options
    if (screen.list && screen.list.sections) {
      for (const section of screen.list.sections) {
        if (section.title) {
          body += `\n_${section.title}_\n`;
        }
        for (const row of section.rows) {
          try {
            const payloadObj = JSON.parse(row.id);
            body += `【${optionCounter}】 *${row.title}*`;
            if (row.description) {
              body += `\n   _${row.description}_`;
            }
            body += '\n';

            optionsMap.push({
              key: optionCounter.toString(),
              payload: payloadObj,
            });
            optionsMap.push({
              key: row.title.toLowerCase().trim(),
              payload: payloadObj,
            });
            optionCounter++;
          } catch (e) {
            // Fallback
          }
        }
      }
    }

    // Back Navigation Card Option
    if (screen.previousScreenId) {
      const backPayload = { a: 'back' };
      body += `\n【B】 ⬅️ *Back*\n`;
      optionsMap.push({
        key: 'b',
        payload: backPayload,
      });
      optionsMap.push({
        key: 'back',
        payload: backPayload,
      });
    }

    if (!screen.inputPrompt) {
      body += `━━━━━━━━━━━━━━\n👇 *Reply with the number shown next to your choice.*`;
    } else {
      body += `━━━━━━━━━━━━━━`;
    }

    return {
      text: body,
      optionsMap,
    };
  }
}
