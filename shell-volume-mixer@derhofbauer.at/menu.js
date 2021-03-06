/**
 * Shell Volume Mixer
 *
 * Volume.VolumeMenu implementation.
 *
 * @author Harry Karvonen <harry.karvonen@gmail.com>
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported Menu */

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Gvc = imports.gi.Gvc;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Volume = imports.ui.status.volume;

const Settings = Extension.imports.settings;
const Widget = Extension.imports.widget;

const Menu = new Lang.Class({
    Name: 'ShellVolumeMixerMenu',
    Extends: Volume.VolumeMenu,

    _init: function(mixer, options) {
        // no this.parent(); shouldn't go through VolumeMenu's setup
        PopupMenu.PopupMenuSection.prototype._init.call(this);

        this._settings = new Settings.Settings();

        this.options = {
            detailed: this._settings.get_boolean('show-detailed-sliders'),
            systemSounds: this._settings.get_boolean('show-system-sounds'),
            symbolicIcons: this._settings.get_boolean('use-symbolic-icons')
        };

        // submenu items
        this._outputs = {};
        // menu items (except for first, MasterSlider)
        this._items = {};

        this._mixer = mixer;
        this._control = mixer.control;
        mixer.connect('state-changed', Lang.bind(this, this._onControlStateChanged));
        mixer.connect('default-sink-changed', Lang.bind(this, this._readOutput));
        mixer.connect('default-source-changed', Lang.bind(this, this._readInput));
        mixer.connect('stream-added', Lang.bind(this, this._streamAdded));
        mixer.connect('stream-removed', Lang.bind(this, this._streamRemoved));

        this._output = new Widget.MasterSlider(this._control, {
            mixer: mixer,
            detailed: this.options.detailed,
            symbolicIcons: this.options.symbolicIcons
        });
        this._output.connect('stream-updated', Lang.bind(this, function() {
            this.emit('icon-changed');
        }));
        this.addMenuItem(this._output.item);

        this._input = new Volume.InputStreamSlider(this._control);
        this.addMenuItem(this._input.item);

        if (options.separator) {
            this._addSeparator();
        }

        this._onControlStateChanged();
    },

    open: function(animate) {
        this._output.hideVolumeInfo();
        this.parent(animate);
    },

    close: function(animate) {
        for (let id in this._outputs) {
            this._outputs[id].hideVolumeInfo();
        }
        for (let id in this._items) {
            this._items[id].hideVolumeInfo();
        }
        this._output.hideVolumeInfo();

        this.parent(animate);
    },

    outputHasHeadphones: function() {
        return this._output._hasHeadphones;
    },

    _addSeparator: function() {
        if (this._separator) {
            this._separator.destroy();
        }

        this._separator = new PopupMenu.PopupSeparatorMenuItem();
        this.addMenuItem(this._separator, 2);
    },

    _onControlStateChanged: function() {
        this.parent();

        if (this._control.get_state() != Gvc.MixerControlState.READY) {
            return;
        }

        let streams = this._control.get_streams();
        for (let stream of streams) {
            this._addStream(this._control, stream);
        }
    },

    _readOutput: function() {
        this.parent();

        if (!this._output.stream) {
            // safety check for failed setups
            return;
        }

        for (let id in this._outputs) {
            this._outputs[id].setSelected(this._output.stream.id == id);
        }
    },

    _addStream: function(control, stream) {
        if (stream.id in this._items
                || stream.id in this._outputs
                || stream.is_event_stream
                || (stream instanceof Gvc.MixerEventRole
                        && !this.options.systemSounds)) {
            return;
        }

        let options = {
            mixer: this._mixer,
            detailed: this.options.detailed,
            symbolicIcons: this.options.symbolicIcons,
            stream: stream
        };

        // system sounds
        if (stream instanceof Gvc.MixerEventRole) {
            let slider = new Widget.EventsSlider(control, options);

            this._items[stream.id] = slider;
            this.addMenuItem(slider.item, 1);

        // input stream
        } else if (stream instanceof Gvc.MixerSinkInput) {
            let slider = new Widget.InputSlider(control, options);

            this._items[stream.id] = slider;
            this.addMenuItem(slider.item);

        // output stream
        } else if (stream instanceof Gvc.MixerSink) {
            let slider = new Widget.OutputSlider(control, options);

            let isSelected = this._output.stream
                    && this._output.stream.id == stream.id;
            slider.setSelected(isSelected);

            this._outputs[stream.id] = slider;
            this._output.item.menu.addMenuItem(slider.item);
        }
    },

    _streamAdded: function(control, id) {
        let stream = control.lookup_stream_id(id);
        this._addStream(control, stream);
    },

    _streamRemoved: function(control, id) {
        if (id in this._items) {
            this._items[id].item.destroy();
            delete this._items[id];
        } else if (id in this._outputs) {
            this._outputs[id].item.destroy();
            delete this._outputs[id];
        }
    }
});