import { IComponentContext } from '../../../types/IComponentContext';
import { IDiscoveryState, IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import getAttr from '../../../util/getAttr';
import { activeGameId } from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';
import Icon from '../../../views/Icon';
import { Button, IconButton } from '../../../views/TooltipControls';

import { setGamePath } from '../../gamemode_management/actions/settings';
import { IProfile } from '../../profile_management/types/IProfile';

import { setGameHidden, setPickerLayout } from '../actions/settings';
import { IDiscoveryResult } from '../types/IDiscoveryResult';
import { IGameStored } from '../types/IGameStored';

import GameRow from './GameRow';
import GameThumbnail from './GameThumbnail';

import * as React from 'react';
import { ListGroup, ListGroupItem, ProgressBar } from 'react-bootstrap';
import { Fixed, Flex, Layout } from 'react-layout-pane';

import update = require('react-addons-update');

interface IConnectedProps {
  lastActiveProfile: { [gameId: string]: string };
  discoveredGames: { [id: string]: IDiscoveryResult };
  profiles: { [profileId: string]: IProfile };
  knownGames: IGameStored[];
  gameMode: string;
  discovery: IDiscoveryState;
  pickerLayout: 'list' | 'small' | 'large';
}

interface IActionProps {
  onHide: (gameId: string, hidden: boolean) => void;
  onSetPickerLayout: (layout: 'list' | 'small' | 'large') => void;
  onSetGamePath: (gameId: string, gamePath: string, modPath: string) => void;
}

interface IComponentState {
  showHidden: boolean;
}

/**
 * picker/configuration for game modes 
 * 
 * @class GamePicker
 */
class GamePicker extends ComponentEx<IConnectedProps & IActionProps, IComponentState> {

  public static contextTypes: React.ValidationMap<any> = {
    api: React.PropTypes.object.isRequired,
  };

  public context: IComponentContext;

  constructor(props) {
    super(props);

    this.state = {
      showHidden: false,
    };
  }

  public render(): JSX.Element {
    const { t, discoveredGames, discovery, knownGames, pickerLayout, profiles } = this.props;
    const { showHidden } = this.state;

    // TODO lots of computation and it doesn't actually change except through discovery
    //   or when adding a profile
    const displayedGames: IGameStored[] = showHidden ? knownGames : knownGames.filter(
      (game: IGameStored) => !getAttr(discoveredGames, game.id, { hidden: false }).hidden);

    const profileGames = new Set<string>(
      Object.keys(profiles).map((profileId: string) => profiles[profileId].gameId));

    let managedGameList: IGameStored[] = [];
    let discoveredGameList: IGameStored[] = [];
    let supportedGameList: IGameStored[] = [];

    displayedGames.forEach((game: IGameStored) => {
      if (getSafe(discoveredGames, [game.id, 'path'], undefined) !== undefined) {
        if (profileGames.has(game.id)) {
          managedGameList.push(game);
        } else {
          discoveredGameList.push(game);
        }
      } else {
        supportedGameList.push(game);
      }
    });

    return (
      <Layout type='column'>
        <Fixed>
          <div>
            <Button
              id='show-hidden-games'
              tooltip={t('Show / Hide hidden games')}
              onClick={this.toggleHidden}
            >
              <Icon name={showHidden ? 'eye-slash' : 'eye'} />
            </Button>
          </div>
          <div id='gamepicker-layout'>
            <IconButton
              id='gamepicker-layout-list'
              className={ pickerLayout === 'list' ? 'btn-toggle-on' : 'btn-toggle-off' }
              onClick={ this.setLayoutList }
              icon='list'
              tooltip={t('List')}
            />
            <IconButton
              id='gamepicker-layout-grid'
              className={ pickerLayout === 'small' ? 'btn-toggle-on' : 'btn-toggle-off' }
              onClick={ this.setLayoutSmall }
              icon='th'
              tooltip={t('Small Icons')}
            />
            <IconButton
              id='gamepicker-layout-grid-large'
              className={ pickerLayout === 'large' ? 'btn-toggle-on' : 'btn-toggle-off' }
              onClick={ this.setLayoutLarge }
              icon='th-large'
              tooltip={t('Large Icons')}
            />
          </div>
        </Fixed>
        <Flex style={{ height: '100%', overflowY: 'auto', padding: '5px' }}>
          <span style={{ display: 'table' }}>
            <h3>{ t('Managed') }</h3>
            { this.renderGames(managedGameList, 'managed') }
          </span>
          <span style={{ display: 'table' }}>
            <h3>{ t('Discovered') }</h3>
            { this.renderGames(discoveredGameList, 'discovered') }
          </span>
          <span style={{ display: 'table' }}>
            <h3>{ t('Supported') }</h3>
            { this.renderGames(supportedGameList, 'undiscovered') }
          </span>
        </Flex>
        <Fixed style={{ height: '40px' }} >
          <Layout type='row'>
            <Flex>
              <ProgressBar
                active={ discovery.running }
                min={ 0 }
                max={ 100 }
                now={ discovery.progress }
                label={ discovery.directory }
              />
            </Flex>
            <Fixed>
              <Button
                id='start-discovery'
                tooltip={ discovery.running ? t('Stop search') : t('Search for games') }
                onClick={ discovery.running ? this.stopDiscovery : this.startDiscovery }
                placement='top'
              >
                <Icon name={ discovery.running ? 'stop' : 'search' } />
              </Button>
            </Fixed>
          </Layout>
        </Fixed>
      </Layout>
    );
  }

  private toggleHidden = () => {
    this.setState(update(this.state, { showHidden: { $set: !this.state.showHidden } }));
  }

  private setLayoutList = () => {
    this.props.onSetPickerLayout('list');
  }

  private setLayoutSmall = () => {
    this.props.onSetPickerLayout('small');
  }

  private setLayoutLarge = () => {
    this.props.onSetPickerLayout('large');
  }

  private startDiscovery = () => {
    this.context.api.events.emit('start-discovery');
  }

  private stopDiscovery = () => {
    this.context.api.events.emit('cancel-discovery');
  }

  private renderGames = (games: IGameStored[], type: string): JSX.Element => {
    const { gameMode, pickerLayout } = this.props;
    switch (pickerLayout) {
      case 'list': return this.renderGamesList(games, type, gameMode);
      case 'small': return this.renderGamesSmall(games, type, gameMode);
      case 'large': return this.renderGamesLarge(games, type, gameMode);
      default: throw new Error('invalid picker layout ' + pickerLayout);
    }
  }

  private renderGamesList(games: IGameStored[], type: string, gameMode: string) {
    const { discoveredGames } = this.props;
    return <ListGroup>
      { games.map(game =>
        <GameRow
          key={game.id}
          game={game}
          discovery={discoveredGames[game.id]}
          type={type}
          active={game.id === gameMode}
          onSetGamePath={this.setGamePath}
        />)
      }
      </ListGroup>;
  }

  private renderGamesSmall(games: IGameStored[], type: string, gameMode: string) {
    return <div>
      { games.map(game =>
        <GameThumbnail
          key={game.id}
          large={false}
          game={game}
          type={type}
          active={game.id === gameMode}
        />)
      }
    </div>;
  }

  private renderGamesLarge(games: IGameStored[], type: string, gameMode: string) {
    return <div>
      { games.map(game =>
        <GameThumbnail
          key={game.id}
          large={true}
          game={game}
          type={type}
          active={game.id === gameMode}
        />)
      }
    </div>;
  }

  private setGamePath = (gameId: string, gamePath: string, modPath: string) => {
    this.props.onSetGamePath(gameId, gamePath, modPath);
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    gameMode: activeGameId(state),
    lastActiveProfile: state.settings.gameMode.lastActiveProfile,
    discoveredGames: state.settings.gameMode.discovered,
    pickerLayout: state.settings.gameMode.pickerLayout,
    profiles: state.persistent.profiles,
    knownGames: state.session.gameMode.known,
    discovery: state.session.discovery,
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onHide: (gameId: string, hidden: boolean) => dispatch(setGameHidden(gameId, hidden)),
    onSetPickerLayout: (layout) => dispatch(setPickerLayout(layout)),
    onSetGamePath: (gameId: string, gamePath: string, modPath: string) =>
      dispatch(setGamePath(gameId, gamePath, modPath)),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(GamePicker)
  ) as React.ComponentClass<{}>;
