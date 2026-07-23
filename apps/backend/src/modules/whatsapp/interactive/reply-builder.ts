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

    // Header
    if (screen.title) {
      body += `*${screen.title}*\n\n`;
    }

    body += screen.body;
    body += '\n\n';

    const optionsMap: Array<{ key: string; payload: any }> = [];
    let optionCounter = 1;

    // Add buttons as numbered selections
    if (screen.buttons && screen.buttons.length > 0) {
      body += `*Options:*\n`;
      for (const btn of screen.buttons) {
        try {
          const payloadObj = JSON.parse(btn.id);
          body += `[${optionCounter}] ${btn.title}\n`;
          optionsMap.push({
            key: optionCounter.toString(),
            payload: payloadObj,
          });
          optionsMap.push({
            key: btn.title.toLowerCase().trim(),
            payload: payloadObj,
          });
          optionCounter++;
        } catch (e) {
          // Fallback if not valid JSON
        }
      }
      body += '\n';
    }

    // Add list items as numbered selections
    if (screen.list && screen.list.sections) {
      body += `*${screen.list.buttonTitle || 'Select an option'}:*\n`;
      for (const section of screen.list.sections) {
        if (section.title) {
          body += `\n_${section.title}_\n`;
        }
        for (const row of section.rows) {
          try {
            const payloadObj = JSON.parse(row.id);
            body += `${optionCounter}. ${row.title}`;
            if (row.description) {
              body += ` - _${row.description}_`;
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

    // Standard Navigation Helper if navigation stack has previous elements
    if (screen.previousScreenId) {
      // We can append Back navigation option
      const backPayload = { a: 'back' };
      body += `\n[B] ↩️ Go Back\n`;
      optionsMap.push({
        key: 'b',
        payload: backPayload,
      });
      optionsMap.push({
        key: 'back',
        payload: backPayload,
      });
    }

    body += '\n━━━━━━━━━━━━━━━━━━\n✨ Reply with the option number or type the option name.';

    return {
      text: body,
      optionsMap,
    };
  }
}
