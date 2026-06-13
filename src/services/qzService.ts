import * as qz from 'qz-tray';

class QZService {
  private connected = false;

  async connect() {
    if (this.connected) return;
    try {
      await qz.websocket.connect();
      this.connected = true;
      console.log('QZ Tray connected');
    } catch (err) {
      console.error('QZ Tray connection error:', err);
      throw err;
    }
  }

  async disconnect() {
    if (!this.connected) return;
    try {
      await qz.websocket.disconnect();
      this.connected = false;
    } catch (err) {
      console.error('QZ Tray disconnect error:', err);
    }
  }

  async findPrinters() {
    await this.connect();
    return await qz.printers.find();
  }

  async printHTML(printerName: string, html: string, options: any = {}) {
    await this.connect();
    
    const config = qz.configs.create(printerName, {
      ...options,
      interpolation: true,
      forceAttribute: true
    });

    const data = [
      {
        type: 'html',
        format: 'plain',
        data: html
      }
    ];

    return await qz.print(config, data);
  }

  isConnected() {
    return this.connected;
  }
}

export const qzService = new QZService();
